import { QueryOrder, sql } from '@mikro-orm/core';
import { ApiClient } from '@twurple/api';
import { AppTokenAuthProvider } from '@twurple/auth';
import got from 'got';
import HttpErrors from 'http-errors';
import { nanoid } from 'nanoid';

import Config from '../Config.js';
import {
	CHAT_RATE_LIMIT_MS,
	TWITCH_API_BASE,
	TWITCH_AUTHORIZATION_URL,
	TWITCH_TOKEN_URL,
	TWITCH_VALIDATE_URL
} from '../constants.js';
import logger from '../logger.js';
import Channel from '../models/Channel.js';
import Credential from '../models/Credential.js';
import Match from '../models/Match.js';
import Stream from '../models/Stream.js';
import { Orm } from '../orm.js';
import {
	MatchListItem,
	MatchesPageResult,
	OAuthRefreshTokenResponse,
	OAuthValidateResponse,
	StreamsPageResult,
	UserInfoResponse
} from '../types.js';

import LiveMonitor from './LiveMonitor.js';
import RateLimitGuard from './RateLimitGuard.js';
import RRFetcher from './RRFetcher.js';
import TaskRunner from './TaskRunner.js';

class App {
	private config: Config;

	public orm: Orm;
	public twitchApi: ApiClient;

	public rrFetcher: RRFetcher;
	public taskRunner: TaskRunner;
	private liveMonitor: LiveMonitor;
	
	private welcomeMessageRateLimitGuard = new RateLimitGuard(
		CHAT_RATE_LIMIT_MS
	);
	private rrMessageRateLimitGuard = new RateLimitGuard(
		CHAT_RATE_LIMIT_MS
	);

	private botAuthorizationState: string | null = null;
	private botTwitchId: string | null = null;

	public readonly botScopes = [
		'user:bot',
		'user:read:chat',
		'user:write:chat'
	];
	public readonly userScopes = ['channel:bot', 'user:read:email'];
	public readonly listPageSize = 25;

	constructor(config: Config, orm: Orm) {
		this.config = config;
		this.orm = orm;
		this.twitchApi = new ApiClient({
			authProvider: new AppTokenAuthProvider(
				this.config.getTwitchClientId(),
				this.config.getTwitchClientSecret()
			)
		});
		this.rrFetcher = new RRFetcher(this.config);
		this.taskRunner = new TaskRunner(this);
		this.liveMonitor = new LiveMonitor(this.config, this);
	}

	public async initialize(): Promise<void> {
		logger.info('Initializing application services');
		await this.liveMonitor.initialize();
		logger.info('Application services initialized');
	}

	public async shutdown(): Promise<void> {
		logger.info('Shutting down application services');
		await this.liveMonitor.shutdown();
		this.taskRunner.stopTasks();
		logger.info('Application services shut down');
	}

	private getBotAuthorizationRedirectUrl() {
		return new URL(
			'/api/oauth/twitch-cb-bot',
			this.config.getPublicUrl()
		).toString();
	}

	private getAuthorizationRedirectUrl() {
		return new URL(
			'/api/oauth/twitch-cb',
			this.config.getPublicUrl()
		).toString();
	}

	public getBotUserAuthorizationUrl(): string {
		this.botAuthorizationState = nanoid();
		logger.info('Generated bot authorization state');

		const url = new URL(TWITCH_AUTHORIZATION_URL);
		url.searchParams.set('client_id', this.config.getTwitchClientId());
		url.searchParams.set(
			'redirect_uri',
			this.getBotAuthorizationRedirectUrl()
		);
		url.searchParams.set('response_type', 'code');
		url.searchParams.set('scope', this.botScopes.join(' '));
		url.searchParams.set('state', this.botAuthorizationState);

		return url.toString();
	}

	public async authorizeBotUser(code: string, state: string): Promise<void> {
		if (!this.config.getBotAuthorizationMode()) {
			throw new HttpErrors.BadRequest('Bot authorization disabled');
		}

		const em = this.orm.em.fork();

		if (state != this.botAuthorizationState) {
			throw new HttpErrors.BadRequest('Invalid authorization state');
		}

		logger.info('Authorizing bot user with Twitch');

		const tokenResponse = await got
			.post(TWITCH_TOKEN_URL, {
				form: {
					client_id: this.config.getTwitchClientId(),
					client_secret: this.config.getTwitchClientSecret(),
					grant_type: 'authorization_code',
					code: code,
					redirect_uri: this.getBotAuthorizationRedirectUrl()
				}
			})
			.json<OAuthRefreshTokenResponse>();

		const validateResponse = await got
			.get(TWITCH_VALIDATE_URL, {
				headers: {
					Authorization: `OAuth ${tokenResponse.access_token}`
				}
			})
			.json<OAuthValidateResponse>();

		if (
			!this.botScopes.every(scope =>
				validateResponse.scopes.includes(scope)
			)
		) {
			throw new HttpErrors.BadRequest('Invalid scopes');
		}

		const botCredentials = await em.findOne(Credential, {
			type: 'bot'
		});

		if (!botCredentials) {
			em.create(Credential, {
				type: 'bot',
				twitchId: validateResponse.user_id,
				accessToken: tokenResponse.access_token,
				refreshToken: tokenResponse.refresh_token,
				obtainmentTimestamp: new Date(),
				expiresIn: tokenResponse.expires_in
			});
		} else {
			botCredentials.twitchId = validateResponse.user_id;
			botCredentials.accessToken = tokenResponse.access_token;
			botCredentials.refreshToken = tokenResponse.refresh_token;
			botCredentials.obtainmentTimestamp = new Date();
			botCredentials.expiresIn = tokenResponse.expires_in;
		}

		await em.flush();
		logger.info('Bot user authorized', {
			twitchId: validateResponse.user_id
		});
	}

	public getAuthorizationUrl(): string {
		const url = new URL(TWITCH_AUTHORIZATION_URL);
		url.searchParams.set('client_id', this.config.getTwitchClientId());
		url.searchParams.set(
			'redirect_uri',
			this.getAuthorizationRedirectUrl()
		);
		url.searchParams.set('response_type', 'code');
		url.searchParams.set('scope', this.userScopes.join(' '));

		return url.toString();
	}

	public async authorizeUser(code: string): Promise<Channel> {
		const em = this.orm.em.fork();
		logger.info('Authorizing broadcaster user with Twitch');

		const tokenResponse = await got
			.post(TWITCH_TOKEN_URL, {
				form: {
					client_id: this.config.getTwitchClientId(),
					client_secret: this.config.getTwitchClientSecret(),
					grant_type: 'authorization_code',
					code: code,
					redirect_uri: this.getAuthorizationRedirectUrl()
				}
			})
			.json<OAuthRefreshTokenResponse>();

		const validateResponse = await got
			.get(TWITCH_VALIDATE_URL, {
				headers: {
					Authorization: `OAuth ${tokenResponse.access_token}`
				}
			})
			.json<OAuthValidateResponse>();

		if (
			!this.userScopes.every(scope =>
				validateResponse.scopes.includes(scope)
			)
		) {
			throw new Error('Invalid scopes');
		}

		let credentials = await em.findOne(Credential, {
			twitchId: validateResponse.user_id
		});

		if (!credentials) {
			credentials = em.create(Credential, {
				type: 'broadcaster',
				twitchId: validateResponse.user_id,
				accessToken: tokenResponse.access_token,
				refreshToken: tokenResponse.refresh_token,
				obtainmentTimestamp: new Date(),
				expiresIn: tokenResponse.expires_in
			});
		} else {
			credentials.accessToken = tokenResponse.access_token;
			credentials.refreshToken = tokenResponse.refresh_token;
			credentials.obtainmentTimestamp = new Date();
			credentials.expiresIn = tokenResponse.expires_in;
		}

		const userInfoResponse = await got
			.get(`${TWITCH_API_BASE}/users`, {
				searchParams: {
					id: credentials.twitchId
				},
				headers: {
					Authorization: `Bearer ${credentials.accessToken}`,
					'Client-Id': this.config.getTwitchClientId()
				}
			})
			.json<UserInfoResponse>();

		if (userInfoResponse.data.length != 1) {
			throw new Error('Failed to fetch user');
		}

		let channel = await em.findOne(Channel, {
			twitchId: credentials.twitchId
		});

		if (!channel) {
			// onboard new channel
			channel = em.create(Channel, {
				twitchId: userInfoResponse.data[0].id,
				name: userInfoResponse.data[0].display_name,
				email: userInfoResponse.data[0].email,
				credential: credentials
			});
		} else {
			channel.name = userInfoResponse.data[0].display_name;
			channel.email = userInfoResponse.data[0].email;
		}

		await em.flush();

		logger.info('Broadcaster user authorized', {
			channelId: channel.id,
			twitchId: channel.twitchId
		});

		return channel;
	}

	public async updateChannelSettings(
		channelId: number,
		settings: {
			active: boolean;
			valorantAccount: string;
		}
	): Promise<Channel> {
		const em = this.orm.em.fork();
		const channel = await em.findOneOrFail(Channel, channelId);
		const previousState = {
			active: channel.active,
			valorantAccount: channel.valorantAccount
		};

		channel.active = settings.active;
		channel.valorantAccount = settings.valorantAccount || null;

		await em.flush();
		logger.info('Channel settings updated', {
			channelId: channel.id,
			twitchId: channel.twitchId,
			previousActive: previousState.active,
			newActive: channel.active,
			previousValorantAccount: previousState.valorantAccount,
			newValorantAccount: channel.valorantAccount
		});
		await this.liveMonitor.syncChannel(channel);

		return channel;
	}

	public async deactivateChannel(channelId: number): Promise<void> {
		const em = this.orm.em.fork();
		const channel = await em.findOneOrFail(Channel, channelId);

		if (!channel.active) {
			return;
		}

		channel.active = false;
		await em.flush();

		logger.warn('Channel deactivated due to invalid Valorant account', {
			channelId: channel.id,
			twitchId: channel.twitchId
		});

		await this.liveMonitor.syncChannel(channel);
	}

	public async getStreamsPage(
		channelId: number,
		page: number
	): Promise<StreamsPageResult> {
		const em = this.orm.em.fork();

		const totalStreams = await em.count(Stream, { channel: channelId });
		const totalPages = Math.max(
			1,
			Math.ceil(totalStreams / this.listPageSize)
		);
		const loadPage = Math.min(page, totalPages);

		const streams = await em
			.createQueryBuilder(Stream, 's')
			.leftJoin('s.matches', 'm')
			.select([
				's.id',
				's.twitchId',
				's.title',
				's.startedAt',
				's.endedAt',
				sql`count(m.id)::int`.as('matchCount'),
				sql`coalesce(sum(m.rr_change), 0)::int`.as('totalRr')
			])
			.where({ channel: channelId })
			.groupBy([
				's.id',
				's.twitchId',
				's.title',
				's.startedAt',
				's.endedAt'
			])
			.orderBy({ 's.startedAt': QueryOrder.DESC })
			.limit(this.listPageSize)
			.offset((loadPage - 1) * this.listPageSize)
			.execute<
				{
					id: number;
					twitchId: string;
					title: string;
					startedAt: Date;
					endedAt: Date | null;
					matchCount: number;
					totalRr: number;
				}[]
			>();

		return {
			streams,
			page: loadPage,
			totalPages,
			totalStreams
		};
	}

	public async getMatchesPage(
		channelId: number,
		page: number
	): Promise<MatchesPageResult> {
		const em = this.orm.em.fork();

		const totalMatches = await em.count(Match, { channel: channelId });
		const totalPages = Math.max(
			1,
			Math.ceil(totalMatches / this.listPageSize)
		);
		const loadPage = Math.min(page, totalPages);

		const matches = (await em.find(
			Match,
			{ channel: channelId },
			{
				orderBy: { createdAt: QueryOrder.DESC },
				limit: this.listPageSize,
				offset: (loadPage - 1) * this.listPageSize
			}
		)) as MatchListItem[];

		return {
			matches,
			page: loadPage,
			totalPages,
			totalMatches
		};
	}

	public async getBotTwitchId(): Promise<string> {
		if (this.botTwitchId) {
			return this.botTwitchId;
		}

		const em = this.orm.em.fork();

		const credentials = await em.findOne(Credential, { type: 'bot' });

		if (!credentials) {
			throw new Error('No credentials available');
		}

		this.botTwitchId = credentials.twitchId;

		return this.botTwitchId;
	}

	public async sendRRChangeMessage(
		channel: Channel,
		stream: Stream,
		match: Match
	): Promise<void> {
		const em = this.orm.em.fork();

		const streamAggregation = await em
			.createQueryBuilder(Match)
			.select([
				sql`count(id)::int`.as('matchCount'),
				sql`coalesce(sum(rr_change), 0)::int`.as('totalRr')
			])
			.where({ stream: stream })
			.execute<{ matchCount: number; totalRr: number }[]>();

		await this.twitchApi.chat.sendChatMessageAsApp(
			await this.getBotTwitchId(),
			channel.twitchId,
			`Last match: ${match.rrChange > 0 ? '+' : ''}${match.rrChange}RR on ${match.map}. Currently ${match.rank} (${match.rr}RR). This stream: ${streamAggregation[0].matchCount} match${streamAggregation[0].matchCount > 1 ? 'es' : ''} with a total of ${streamAggregation[0].totalRr > 0 ? '+' : ''}${streamAggregation[0].totalRr}RR.`
		);
		logger.info('Sent RR change message', {
			channelId: channel.id,
			streamId: stream.id,
			matchId: match.matchId
		});
	}

	public async sendWelcomeMessage(channel: Channel): Promise<void> {
		if (!this.welcomeMessageRateLimitGuard.isAllowed(channel)) {
			logger.info('Skipped welcome message due to rate limit', {
				channelId: channel.id,
				twitchId: channel.twitchId
			});
			return;
		}

		await this.twitchApi.chat.sendChatMessageAsApp(
			await this.getBotTwitchId(),
			channel.twitchId,
			'Welcome! Send !rr or !rank to see current rank.'
		);
		logger.info('Sent welcome message', {
			channelId: channel.id,
			twitchId: channel.twitchId
		});
	}

	public async sendRRMessage(channel: Channel): Promise<void> {
		if (!this.rrMessageRateLimitGuard.isAllowed(channel)) {
			logger.info('Skipped RR status message due to rate limit', {
				channelId: channel.id,
				twitchId: channel.twitchId
			});
			return;
		}

		const em = this.orm.em.fork();

		const lastMatch = await em.findOne(
			Match,
			{
				channel: channel
			},
			{ last: 1 }
		);

		await this.twitchApi.chat.sendChatMessageAsApp(
			await this.getBotTwitchId(),
			channel.twitchId,
			lastMatch
				? `Currently ${lastMatch.rank} (${lastMatch.rr}RR).`
				: 'Rank not available yet.'
		);
		logger.info('Sent RR status message', {
			channelId: channel.id,
			twitchId: channel.twitchId,
			hasMatch: !!lastMatch
		});
	}
}

export default App;
