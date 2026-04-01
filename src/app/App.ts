import got from "got";
import Config from "../Config.js";
import { TWITCH_API_BASE, TWITCH_AUTHORIZATION_URL, TWITCH_TOKEN_URL, TWITCH_VALIDATE_URL } from "../constants.js";
import { Orm } from "../orm.js";
import { MatchListItem, MatchesPageResult, OAuthRefreshTokenResponse, OAuthValidateResponse, StreamsPageResult, UserInfoResponse } from "../types.js";
import Credential from "../models/Credential.js";
import { addSeconds } from "date-fns";
import { nanoid } from "nanoid";
import HttpErrors from 'http-errors'
import Channel from "../models/Channel.js";
import Match from "../models/Match.js";
import { QueryOrder, sql } from "@mikro-orm/core";
import Stream from "../models/Stream.js";
import TaskRunner from "./TaskRunner.js";
import { ApiClient } from "@twurple/api";
import { AppTokenAuthProvider } from "@twurple/auth";
import RRFetcher from "./RRFetcher.js";
import LiveMonitor from "./LiveMonitor.js";

class App {
	private config: Config

	public orm: Orm
	public twitchApi: ApiClient;
	
	public rrFetcher: RRFetcher;
	public taskRunner: TaskRunner;
	private liveMonitor: LiveMonitor;

	private botAuthorizationState: string | null = null
	private botTwitchId: string | null = null;

	private readonly botScopes = ['user:bot', 'user:read:chat', 'user:write:chat'];
	private readonly userScopes = ['channel:bot', 'user:read:email']
	private readonly listPageSize = 25

	constructor(config: Config, orm: Orm) {
		this.config = config;
		this.orm = orm;
		this.twitchApi = new ApiClient({
			authProvider: new AppTokenAuthProvider(this.config.getTwitchClientId(), this.config.getTwitchClientSecret())
		})
		this.rrFetcher = new RRFetcher(this.config);
		this.taskRunner = new TaskRunner(this);
		this.liveMonitor = new LiveMonitor(this.config, this);
	}

	public async initialize(): Promise<void> {
		await this.liveMonitor.initialize();
	}

	public async shutdown(): Promise<void> {
		await this.liveMonitor.shutdown();
		this.taskRunner.stopTasks();
	}

	private getBotAuthorizationRedirectUrl() {
		return new URL('/api/oauth/twitch-cb-bot', this.config.getPublicUrl()).toString()
	}

	private getAuthorizationRedirectUrl() {
		return new URL('/api/oauth/twitch-cb', this.config.getPublicUrl()).toString()
	}

	public getBotUserAuthorizationUrl(): string {
		this.botAuthorizationState = nanoid()

		const url = new URL(TWITCH_AUTHORIZATION_URL)
		url.searchParams.set('client_id', this.config.getTwitchClientId())
		url.searchParams.set('redirect_uri', this.getBotAuthorizationRedirectUrl()),
		url.searchParams.set('response_type', 'code')
		url.searchParams.set('scope', this.botScopes.join(' '))
		url.searchParams.set('state', this.botAuthorizationState)

		return url.toString();
	}

	public async authorizeBotUser(code: string, state: string): Promise<void> {
		const em = this.orm.em.fork();

		if(state != this.botAuthorizationState) {
			throw new HttpErrors.BadRequest('Invalid authorization state')
		}

		const tokenResponse = await got.post(TWITCH_TOKEN_URL, {
			form: {
				client_id: this.config.getTwitchClientId(),
				client_secret: this.config.getTwitchClientSecret(),
				grant_type: 'authorization_code',
				code: code,
				redirect_uri: this.getBotAuthorizationRedirectUrl()
			}
		}).json<OAuthRefreshTokenResponse>()

		const validateResponse = await got.get(TWITCH_VALIDATE_URL, {
			headers: {
				Authorization: `OAuth ${tokenResponse.access_token}`
			}
		}).json<OAuthValidateResponse>();

		if(!this.botScopes.every(scope => validateResponse.scopes.includes(scope))) {
			throw new HttpErrors.BadRequest('Invalid scopes')
		}

		const botCredentials = await em.findOne(Credential, {
			type: 'bot'
		})

		if(!botCredentials) {
			em.create(Credential, {
				type: 'bot',
				twitchId: validateResponse.user_id,
				accessToken: tokenResponse.access_token,
				refreshToken: tokenResponse.refresh_token,
				expiresAt: addSeconds(new Date(), tokenResponse.expires_in - 300)
			})
		}
		else {
			botCredentials.twitchId = validateResponse.user_id;
			botCredentials.accessToken = tokenResponse.access_token;
			botCredentials.refreshToken = tokenResponse.refresh_token;
			botCredentials.expiresAt = addSeconds(new Date(), tokenResponse.expires_in - 300)
		}

		await em.flush()
	}

	public getAuthorizationUrl(): string {
		const url = new URL(TWITCH_AUTHORIZATION_URL)
		url.searchParams.set('client_id', this.config.getTwitchClientId())
		url.searchParams.set('redirect_uri', this.getAuthorizationRedirectUrl()),
		url.searchParams.set('response_type', 'code')
		url.searchParams.set('scope', this.userScopes.join(' '))

		return url.toString()
	}

	public async authorizeUser(code: string): Promise<Channel> {
		const em = this.orm.em.fork();

		const tokenResponse = await got.post(TWITCH_TOKEN_URL, {
			form: {
				client_id: this.config.getTwitchClientId(),
				client_secret: this.config.getTwitchClientSecret(),
				grant_type: 'authorization_code',
				code: code,
				redirect_uri: this.getAuthorizationRedirectUrl()
			}
		}).json<OAuthRefreshTokenResponse>()

		const validateResponse = await got.get(TWITCH_VALIDATE_URL, {
			headers: {
				Authorization: `OAuth ${tokenResponse.access_token}`
			}
		}).json<OAuthValidateResponse>()

		if(!this.userScopes.every(scope => validateResponse.scopes.includes(scope))) {
			throw new Error('Invalid scopes')
		}

		let credentials = await em.findOne(Credential, {twitchId: validateResponse.user_id});

		if(!credentials) {
			credentials = em.create(Credential, {
				type: 'broadcaster',
				twitchId: validateResponse.user_id,
				accessToken: tokenResponse.access_token,
				refreshToken: tokenResponse.refresh_token,
				expiresAt: addSeconds(new Date(), tokenResponse.expires_in - 300)
			})
		} else {
			credentials.accessToken = tokenResponse.access_token;
			credentials.refreshToken = tokenResponse.refresh_token;
			credentials.expiresAt = addSeconds(new Date(), tokenResponse.expires_in - 300)
		}

		const userInfoResponse = await got.get(`${TWITCH_API_BASE}/users`, {
			searchParams: {
				id: credentials.twitchId
			},
			headers: {
				Authorization: `Bearer ${credentials.accessToken}`,
				'Client-Id': this.config.getTwitchClientId()
			}
		}).json<UserInfoResponse>();

		if(userInfoResponse.data.length != 1) {
			throw new Error('Failed to fetch user')
		}

		let channel = await em.findOne(Channel, {twitchId: credentials.twitchId});

		if(!channel) {
			// onboard new channel
			channel = em.create(Channel, {
				twitchId: userInfoResponse.data[0].id,
				name: userInfoResponse.data[0].display_name,
				email: userInfoResponse.data[0].email,
				credential: credentials
			})
		} else {
			channel.name = userInfoResponse.data[0].display_name;
			channel.email = userInfoResponse.data[0].email
		}

		await em.flush();

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
		const channel = await em.findOneOrFail(Channel, channelId)

		channel.active = settings.active
		channel.valorantAccount = settings.valorantAccount || null

		await em.flush()
		await this.liveMonitor.syncChannel(channel)

		return channel
	}

	public async getStreamsPage(channelId: number, page: number): Promise<StreamsPageResult> {
		const em = this.orm.em.fork();

		const totalStreams = await em.count(Stream, {channel: channelId})
		const totalPages = Math.max(1, Math.ceil(totalStreams/this.listPageSize))
		const loadPage = Math.min(page, totalPages)

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
		    sql`coalesce(sum(m.rr_change), 0)::int`.as('totalRr'),
		  ])
		  .where({ channel: channelId })
		  .groupBy(['s.id', 's.twitchId', 's.title', 's.startedAt', 's.endedAt'])
		  .orderBy({ 's.startedAt': QueryOrder.DESC })
		  .limit(this.listPageSize)
		  .offset((loadPage - 1) * this.listPageSize)
		  .execute<{
		    id: number;
		    twitchId: string;
		    title: string;
		    startedAt: Date;
		    endedAt: Date | null;
		    matchCount: number;
		    totalRr: number;
		  }[]>();

		return {
			streams,
			page: loadPage,
			totalPages,
			totalStreams
		}
	}

	public async getMatchesPage(channelId: number, page: number): Promise<MatchesPageResult> {
		const em = this.orm.em.fork();

		const totalMatches = await em.count(Match, {channel: channelId})
		const totalPages = Math.max(1, Math.ceil(totalMatches / this.listPageSize))
		const loadPage = Math.min(page, totalPages)

		const matches = await em.find(Match, {channel: channelId}, {
			orderBy: {createdAt: QueryOrder.DESC},
			limit: this.listPageSize,
			offset: (loadPage - 1) * this.listPageSize
		}) as MatchListItem[]

		return {
			matches,
			page: loadPage,
			totalPages,
			totalMatches
		}
	}

	public async getBotTwitchId(): Promise<string> {
		if(this.botTwitchId) {
			return this.botTwitchId;
		}

		const em = this.orm.em.fork();

		const credentials = await em.findOne(Credential, {type: 'bot'});

		if(!credentials) {
			throw new Error('No credentials available')
		}

		this.botTwitchId = credentials.twitchId;

		return this.botTwitchId;
	}

	public async sendRRChangeMessage(channel: Channel, stream: Stream, match: Match): Promise<void> {
		const em = this.orm.em.fork();

		const streamAggregation = await em.createQueryBuilder(Match)
			.select([
				sql`count(id)::int`.as('matchCount'),
		    	sql`coalesce(sum(rr_change), 0)::int`.as('totalRr')
			])
			.where({stream: stream})
			.execute<{matchCount: number, totalRr: number}>()

		await this.twitchApi.asUser(await this.getBotTwitchId(), async ctx => {
			await ctx.chat.sendChatMessage(channel.twitchId,
				`Last match: ${match.rrChange > 0 ? '+' : ''}${match.rrChange}RR on ${match.map}. Currently ${match.rank} (${match.rr}RR). This stream: ${streamAggregation.matchCount} match${streamAggregation.matchCount > 1 ? 'es' : ''} with a total of ${streamAggregation.totalRr > 0 ? '+' : ''}${streamAggregation.totalRr}RR.`
			)
		})
	}

	public async sendWelcomeMessage(channel: Channel): Promise<void> {
		await this.twitchApi.asUser(await this.getBotTwitchId(), async ctx => {
			await ctx.chat.sendChatMessage(channel.twitchId, 'Welcome! Send !rr or !rank to see current rank.')
		})
	}

	public async sendRRMessage(channel: Channel): Promise<void> {
		const em = this.orm.em.fork();

		const lastMatch = await em.findOne(Match, {
			channel: channel
		}, {last: 1});

		await this.twitchApi.asUser(await this.getBotTwitchId(), async ctx => {
			await ctx.chat.sendChatMessage(channel.twitchId, lastMatch ? `Currently ${lastMatch.rank} (${lastMatch.rr}RR).` : 'Rank not available yet.')
		})
	}
}

export default App;
