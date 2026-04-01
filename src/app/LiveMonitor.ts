import { RefreshingAuthProvider } from "@twurple/auth";
import App from "./App.js";
import { EventSubWsListener } from "@twurple/eventsub-ws";
import {EventSubSubscription} from '@twurple/eventsub-base'
import { ApiClient, HelixStream } from "@twurple/api";
import Config from "../Config.js";
import Credential from "../models/Credential.js";
import Channel from "../models/Channel.js";
import Stream from "../models/Stream.js";
import pLimit from "p-limit";
import { AsyncTask, SimpleIntervalJob, ToadScheduler } from "toad-scheduler";
import { TWITCH_VALORANT_GAME_ID } from "../constants.js";
import logger from "../logger.js";

class LiveMonitor {
	private config: Config;
	private app: App

	private authProvider: RefreshingAuthProvider;
	private apiClient: ApiClient;
	private listener: EventSubWsListener;

	private botId: string | null = null;

	private scheduler = new ToadScheduler()

	private subscriptions: Map<number, {channel: Channel, online: EventSubSubscription, offline: EventSubSubscription, chat: EventSubSubscription}> = new Map()
	private liveChannels = new Set<number>()

	constructor(config: Config, app: App) {
		this.config = config;
		this.app = app;

		this.authProvider = new RefreshingAuthProvider({
			clientId: this.config.getTwitchClientId(),
			clientSecret: this.config.getTwitchClientSecret()
		})
		this.apiClient = new ApiClient({authProvider: this.authProvider})
		this.listener = new EventSubWsListener({apiClient: this.apiClient})

		this.authProvider.onRefresh(async (userId, token) => {
			const em = this.app.orm.em.fork();

			const credentials = await em.findOne(Credential, {
				twitchId: userId
			})

			if(!credentials) {
				logger.warn('Received refreshed token for unknown Twitch user', {
					userId
				})
				return;
			}

			credentials.accessToken = token.accessToken;
			credentials.refreshToken = token.refreshToken as string;
			credentials.obtainmentTimestamp = new Date(token.obtainmentTimestamp);
			credentials.expiresIn = token.expiresIn as number;

			await em.flush();
			logger.info('Stored refreshed Twitch credentials', {
				userId,
				type: credentials.type
			})
		})
	}

	public async initialize(): Promise<void> {
		const em = this.app.orm.em.fork();
		logger.info('Initializing live monitor')

		const credentials = await em.findOne(Credential, {type: 'bot'})

		if(!credentials) {
			throw new Error('No credentials')
		}

		this.botId = credentials.twitchId;

		await this.authProvider.addUserForToken({
			accessToken: credentials.accessToken,
			refreshToken: credentials.refreshToken,
			obtainmentTimestamp: credentials.obtainmentTimestamp.getTime(),
			expiresIn: credentials.expiresIn,
		})

		this.listener.start();
		logger.info('EventSub listener started')

		await this.loadChannels();
		await this.reconcileEligibleChannels(false);
		this.startReconcileTask();
		logger.info('Live monitor initialized')
	}

	public async shutdown(): Promise<void> {
		logger.info('Shutting down live monitor')
		this.scheduler.stop()
		for (const subscription of this.subscriptions.values()) {
			subscription.online.stop()
			subscription.offline.stop()
			subscription.chat.stop()
		}
		this.subscriptions.clear()
		this.liveChannels.clear()
		this.listener.stop()
		logger.info('Live monitor shut down')
	}

	private async loadChannels(): Promise<void> {
		const em = this.app.orm.em.fork();

		const channels = await em.find(Channel, {
			active: true,
			valorantAccount: {
				$ne: null
			}
		})

		await Promise.all(channels.map(async channel => {
			await this.addChannel(channel)
		}))
		logger.info('Loaded eligible channels for live monitor', {
			channelCount: channels.length
		})
	}

	private startReconcileTask(): void {
		this.scheduler.addSimpleIntervalJob(
			new SimpleIntervalJob(
				{minutes: 5, runImmediately: false},
				new AsyncTask('stream-reconcile-task', async () => {
					await this.reconcileEligibleChannels(true)
				}, error => {
					logger.error('Stream reconcile task failed', {
						error: error instanceof Error ? error.message : String(error)
					})
				}),
				{id: 'stream-reconcile', preventOverrun: true}
			)
		)
	}

	private async reconcileEligibleChannels(sendWelcome: boolean): Promise<void> {
		const em = this.app.orm.em.fork();
		const channels = await em.find(Channel, {
			active: true,
			valorantAccount: {
				$ne: null
			}
		})
		const limit = pLimit(50)

		await Promise.all(channels.map(channel => limit(async () => {
			try {
				await this.reconcileChannel(channel, sendWelcome)
			} catch (error) {
				logger.error('Channel reconcile failed', {
					channelId: channel.id,
					twitchId: channel.twitchId,
					error: error instanceof Error ? error.message : String(error)
				})
			}
		})))
	}

	private async safelyHandleChannelEvent(
		channel: Channel,
		action: 'online' | 'offline' | 'chat',
		handler: () => Promise<void>
	): Promise<void> {
		try {
			await handler()
		} catch (error) {
			logger.error('Live monitor channel event failed', {
				action,
				channelId: channel.id,
				twitchId: channel.twitchId,
				error: error instanceof Error ? error.message : String(error)
			})
		}
	}

	private async ensureChannelCredentialsAdded(channel: Channel): Promise<boolean> {
		const em = this.app.orm.em.fork();
		const channelWithCredential = await em.findOne(Channel, channel.id, {
			populate: ['credential']
		})

		if(!channelWithCredential?.credential) {
			logger.warn('Skipping channel registration because credential is missing', {
				channelId: channel.id,
				twitchId: channel.twitchId
			})
			return false
		}

		this.authProvider.addUser(channelWithCredential.twitchId, {
			accessToken: channelWithCredential.credential.accessToken,
			refreshToken: channelWithCredential.credential.refreshToken,
			obtainmentTimestamp: channelWithCredential.credential.obtainmentTimestamp.getTime(),
			expiresIn: channelWithCredential.credential.expiresIn
		})

		logger.info('Added broadcaster credentials to auth provider', {
			channelId: channel.id,
			twitchId: channel.twitchId
		})

		return true
	}

	private async addChannel(channel: Channel): Promise<void> {
		if(this.subscriptions.has(channel.id)) {
			return;
		}

		if(!(await this.ensureChannelCredentialsAdded(channel))) {
			return;
		}

		logger.info('Registering live monitor subscriptions for channel', {
			channelId: channel.id,
			twitchId: channel.twitchId
		})

		this.subscriptions.set(channel.id, {
			channel,
				online: this.listener.onStreamOnline(channel.twitchId, async event => {
					const stream = await event.getStream();
					if(!stream) {
						return;
					}

					await this.safelyHandleChannelEvent(channel, 'online', async () => {
						await this.handleOnline(channel, stream, true)
					})
				}),
			offline: this.listener.onStreamOffline(channel.twitchId, async () => {
				await this.safelyHandleChannelEvent(channel, 'offline', async () => {
					await this.handleOffline(channel)
				})
			}),
			chat: this.listener.onChannelChatMessage(channel.twitchId, this.botId as string, async event => {
				if(['!rr', '!rank'].includes(event.messageText.trim())) {
					await this.safelyHandleChannelEvent(channel, 'chat', async () => {
						await this.app.sendRRMessage(channel)
					})
				}
			})
		})
	}

	private async removeChannel(channel: Channel): Promise<void> {
		const subscription = this.subscriptions.get(channel.id)

		if(subscription) {
			subscription.online.stop();
			subscription.offline.stop();
			subscription.chat.stop();
		}

		this.liveChannels.delete(channel.id)
		this.app.taskRunner.stopRRUpdateTask(channel)
		this.subscriptions.delete(channel.id)
		await this.handleOffline(channel)
		logger.info('Removed channel from live monitor', {
			channelId: channel.id,
			twitchId: channel.twitchId
		})
	}

	public async syncChannel(channel: Channel): Promise<void> {
		const isEligible = channel.active && channel.valorantAccount != null;

		if(this.subscriptions.has(channel.id) && !isEligible) {
			await this.removeChannel(channel);
			return;
		}

		if(!this.subscriptions.has(channel.id) && isEligible) {
			await this.addChannel(channel);
		}

		if(isEligible) {
			await this.reconcileChannel(channel, false)
		}
	}

	private async upsertLiveStream(channel: Channel, liveStream: HelixStream): Promise<Stream> {
		const em = this.app.orm.em.fork();

		await em.nativeUpdate(Stream, {
			channel: channel,
			endedAt: null,
			twitchId: {
				$ne: liveStream.id
			}
		}, {
			endedAt: new Date()
		})

		let stream = await em.findOne(Stream, {
			channel: channel,
			twitchId: liveStream.id
		})

		if(!stream) {
			stream = em.create(Stream, {
				twitchId: liveStream.id,
				title: liveStream.title,
				startedAt: liveStream.startDate,
				channel: channel
			})
		} else {
			stream.title = liveStream.title
			stream.startedAt = liveStream.startDate
			stream.endedAt = null
		}

		await em.flush();

		logger.info('Upserted live stream', {
			channelId: channel.id,
			twitchId: channel.twitchId,
			streamTwitchId: liveStream.id,
			streamId: stream.id
		})

		return stream
	}

	private async handleOnline(channel: Channel, liveStream: HelixStream, sendWelcome: boolean): Promise<void> {
		if(liveStream.type != 'live' || liveStream.gameId != TWITCH_VALORANT_GAME_ID) {
			logger.info('Ignoring non-live or non-Valorant stream state', {
				channelId: channel.id,
				twitchId: channel.twitchId,
				streamTwitchId: liveStream.id,
				streamType: liveStream.type,
				gameId: liveStream.gameId
			})
			await this.handleOffline(channel)
			return;
		}

		const wasLive = this.liveChannels.has(channel.id)
		this.liveChannels.add(channel.id);

		const stream = await this.upsertLiveStream(channel, liveStream)
		this.app.taskRunner.startRRUpdateTask(channel, stream)
		logger.info('Channel marked live', {
			channelId: channel.id,
			twitchId: channel.twitchId,
			streamId: stream.id,
			streamTwitchId: stream.twitchId,
			sendWelcome
		})

		if(!wasLive && sendWelcome) {
			await this.app.sendWelcomeMessage(channel);
		}
	}

	private async handleOffline(channel: Channel): Promise<void> {
		this.liveChannels.delete(channel.id)
		this.app.taskRunner.stopRRUpdateTask(channel)

		const em = this.app.orm.em.fork();

		await em.nativeUpdate(Stream, {
			channel: channel,
			endedAt: null
			}, {
				endedAt: new Date()
			})
		logger.info('Channel marked offline', {
			channelId: channel.id,
			twitchId: channel.twitchId
		})
	}

	private async reconcileChannel(channel: Channel, sendWelcome: boolean): Promise<void> {
		const liveStream = await this.app.twitchApi.streams.getStreamByUserIdBatched(channel.twitchId);

		if(!liveStream) {
			await this.handleOffline(channel)
			return;
		}

		await this.handleOnline(channel, liveStream, sendWelcome)
	}
}

export default LiveMonitor;
