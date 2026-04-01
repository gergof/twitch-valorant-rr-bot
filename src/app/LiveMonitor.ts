import { RefreshingAuthProvider } from "@twurple/auth";
import App from "./App.js";
import { EventSubWsListener } from "@twurple/eventsub-ws";
import {EventSubSubscription} from '@twurple/eventsub-base'
import { ApiClient, HelixStream } from "@twurple/api";
import Config from "../Config.js";
import Credential from "../models/Credential.js";
import { addSeconds } from "date-fns";
import Channel from "../models/Channel.js";
import Stream from "../models/Stream.js";
import pLimit from "p-limit";
import { AsyncTask, SimpleIntervalJob, ToadScheduler } from "toad-scheduler";
import { TWITCH_VALORANT_GAME_ID } from "../constants.js";

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

		this.authProvider.onRefresh(async (_userId, token) => {
			const em = this.app.orm.em.fork();

			const credentials = await em.findOne(Credential, {
				type: 'bot'
			})

			if(!credentials) {
				return;
			}

			credentials.accessToken = token.accessToken;
			credentials.refreshToken = token.refreshToken as string;
			credentials.expiresAt = addSeconds(new Date(), (token.expiresIn as number) - 300)

			await em.flush();
		})
	}

	public async initialize(): Promise<void> {
		const em = this.app.orm.em.fork();

		const credentials = await em.findOne(Credential, {type: 'bot'})

		if(!credentials) {
			throw new Error('No credentials')
		}

		this.botId = credentials.twitchId;

		this.authProvider.addUser(credentials.twitchId, {
			accessToken: credentials.accessToken,
			refreshToken: credentials.refreshToken
		} as any)

		this.listener.start();

		await this.loadChannels();
		this.startReconcileTask();
	}

	public async shutdown(): Promise<void> {
		this.scheduler.stop()
		for (const subscription of this.subscriptions.values()) {
			subscription.online.stop()
			subscription.offline.stop()
			subscription.chat.stop()
		}
		this.subscriptions.clear()
		this.liveChannels.clear()
		this.listener.stop()
	}

	private async loadChannels(): Promise<void> {
		const em = this.app.orm.em.fork();

		const channels = await em.find(Channel, {
			active: true,
			valorantAccount: {
				$ne: null
			}
		})

		channels.forEach(channel => {
			this.addChannel(channel)
		})
	}

	private startReconcileTask(): void {
		this.scheduler.addSimpleIntervalJob(
			new SimpleIntervalJob(
				{minutes: 5, runImmediately: true},
				new AsyncTask('stream-reconcile-task', async () => {
					const em = this.app.orm.em.fork();

					const channels = await em.find(Channel, {
						active: true,
						valorantAccount: {
							$ne: null
						}
					}, {
						populate: ['streams'],
						populateWhere: {
							streams: {
								endedAt: null
							}
						}
					})

					await Promise.all(channels.map(async channel => {
						const liveStream = await this.app.twitchApi.streams.getStreamByUserIdBatched(channel.twitchId);

						if(!liveStream) {
							// channel is offline
							await this.handleOffline(channel)
							return;
						}

						if(channel.streams.length) {
							// we have streams currently running for the channel
							// end non-current streams
							const endedStreams = channel.streams.reduce((acc, cur) => {
								if(cur.twitchId != liveStream.id) {
									cur.endedAt = new Date()
									return acc + 1
								}

								return acc;
							}, 0)
							await em.flush()
							if(endedStreams == channel.streams.length) {
								await this.handleOffline(channel)
							}
						}

						if(!channel.streams.find(stream => stream.twitchId == liveStream.id)) {
							await this.handleOnline(channel, liveStream)
						}
					}))
				}),
				{id: 'stream-reconcile', preventOverrun: true}
			)
		)
	}

	private addChannel(channel: Channel): void {
		if(this.subscriptions.has(channel.id)) {
			return;
		}

		this.subscriptions.set(channel.id, {
			channel,
			online: this.listener.onStreamOnline(channel.twitchId, async event => {
				const stream = await event.getStream();
				if(!stream) {
					return;
				}

				await this.handleOnline(channel, stream)
			}),
			offline: this.listener.onStreamOffline(channel.twitchId, async () => {
				await this.handleOffline(channel)
			}),
			chat: this.listener.onChannelChatMessage(channel.twitchId, this.botId as string, async event => {
				if(['!rr', '!rank'].includes(event.messageText.trim())) {
					await this.app.sendRRMessage(channel)
				}
			})
		})
	}

	private removeChannel(channel: Channel): void {
		const subscription = this.subscriptions.get(channel.id)

		if(subscription) {
			subscription.online.stop();
			subscription.offline.stop();
		}

		this.subscriptions.delete(channel.id)
	}

	public syncChannel(channel: Channel): void {
		const isEligible = channel.active && channel.valorantAccount != null;

		if(this.subscriptions.has(channel.id) && !isEligible) {
			this.removeChannel(channel);
			return;
		}

		if(!this.subscriptions.has(channel.id) && isEligible) {
			this.addChannel(channel);
			return
		}
	}

	private async handleOnline(channel: Channel, liveStream: HelixStream): Promise<void> {
		if(liveStream.type != 'live') {
			return;
		}

		if(liveStream.gameId != TWITCH_VALORANT_GAME_ID) {
			return;
		}

		if(this.liveChannels.has(channel.id)) {
			return;
		}

		this.liveChannels.add(channel.id);

		const em = this.app.orm.em.fork();

		let stream = await em.findOne(Stream, {
			twitchId: liveStream.id
		})

		if(!stream) {
			stream = em.create(Stream, {
				twitchId: liveStream.id,
				title: liveStream.title,
				startedAt: new Date(),
				channel: channel
			})
			await em.flush();
		}

		this.app.taskRunner.startRRUpdateTask(channel, stream)
		await this.app.sendWelcomeMessage(channel);
	}

	private async handleOffline(channel: Channel): Promise<void> {
		if(!this.liveChannels.has(channel.id)) {
			return;
		}

		this.liveChannels.delete(channel.id)
		this.app.taskRunner.stopRRUpdateTask(channel)

		const em = this.app.orm.em.fork();

		await em.nativeUpdate(Stream, {
			channel: channel,
			endedAt: null
		}, {
			endedAt: new Date()
		})
	}
}

export default LiveMonitor;
