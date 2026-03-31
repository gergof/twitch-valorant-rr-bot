import { RefreshingAuthProvider } from "@twurple/auth";
import App from "./App.js";
import { EventSubWsListener } from "@twurple/eventsub-ws";
import {EventSubSubscription} from '@twurple/eventsub-base'
import { ApiClient } from "@twurple/api";
import Config from "../Config.js";
import Credential from "../models/Credential.js";
import { addSeconds } from "date-fns";
import Channel from "../models/Channel.js";

class LiveMonitor {
	private config: Config;
	private app: App

	private authProvider: RefreshingAuthProvider;
	private apiClient: ApiClient;
	private listener: EventSubWsListener;

	private subscriptions: Map<number, {online: EventSubSubscription, offline: EventSubSubscription}> = new Map()
	private liveChannels: Set<Channel> = new Set()

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

	public async initialize() {
		const em = this.app.orm.em.fork();

		const credentials = await em.findOne(Credential, {type: 'bot'})

		if(!credentials) {
			throw new Error('No credentials')
		}

		this.authProvider.addUser(credentials.twitchId, {
			accessToken: credentials.accessToken,
			refreshToken: credentials.refreshToken
		} as any)

		this.listener.start();

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

	public addChannel(channel: Channel) {
		if(this.subscriptions.has(channel.id)) {
			return;
		}

		this.subscriptions.set(channel.id, {
			online: this.listener.onStreamOnline(channel.twitchId, () => {
				console.log('channel online:', channel)
				this.liveChannels.add(channel)
			}),
			offline: this.listener.onStreamOffline(channel.twitchId, () => {
				console.log('channel offline:', channel)
				this.liveChannels.delete(channel)
			})
		})
	}

	public removeChannel(channel: Channel) {
		const subs = this.subscriptions.get(channel.id);

		if(!subs) {
			return;
		}

		subs.online.stop();
		subs.offline.stop();

		this.subscriptions.delete(channel.id);
	}
}

export default LiveMonitor;