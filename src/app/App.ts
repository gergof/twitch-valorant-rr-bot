import got from "got";
import Config from "../Config.js";
import { TWITCH_API_BASE, TWITCH_AUTHORIZATION_URL, TWITCH_TOKEN_URL, TWITCH_VALIDATE_URL } from "../constants.js";
import { Orm } from "../orm.js";
import AppTokenProvider from "../twitch/AppTokenProvider.js";
import { OAuthRefreshTokenResponse, OAuthValidateResponse, UserInfoResponse } from "../types.js";
import Credential from "../models/Credential.js";
import { addSeconds } from "date-fns";
import CredentialHelper from "../twitch/CredentialHelper.js";
import { nanoid } from "nanoid";
import HttpErrors from 'http-errors'
import Channel from "../models/Channel.js";

class App {
	private config: Config
	private orm: Orm
	private appTokenProvider: AppTokenProvider

	private botAuthorizationState: string | null = null
	private botCredentialHelper: CredentialHelper | null = null;

	private botScopes = ['user:bot', 'user:read:chat', 'user:write:chat'];
	private userScopes = ['channel:bot', 'user:read:email']

	constructor(config: Config, orm: Orm) {
		this.config = config;
		this.orm = orm;
		this.appTokenProvider = new AppTokenProvider(config);
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

	public async getBotCredentialHelper(): Promise<CredentialHelper> {
		const em = this.orm.em.fork();

		if(this.botCredentialHelper) {
			return this.botCredentialHelper;
		}

		const botCredentials = await em.findOneOrFail(Credential, {
			type: 'bot'
		})

		this.botCredentialHelper = new CredentialHelper(this.config, this.orm, botCredentials.id)

		return this.botCredentialHelper;
	}

	public getAuthorizationUrl(): string {
		const url = new URL(TWITCH_AUTHORIZATION_URL)
		url.searchParams.set('client_id', this.config.getTwitchClientId())
		url.searchParams.set('redirect_uri', this.getAuthorizationRedirectUrl()),
		url.searchParams.set('response_type', 'code')
		url.searchParams.set('scope', this.userScopes.join(' '))

		return url.toString()
	}

	public async authorizeUser(code: string): Promise<void> {
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
	}
}

export default App;