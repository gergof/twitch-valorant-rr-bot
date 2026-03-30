import got, { Headers, RequestError } from "got";
import Config from "../Config.js";
import { TWITCH_TOKEN_URL, TWITCH_VALIDATE_URL } from "../constants.js";
import Credential from "../models/Credential.js";
import { Orm } from "../orm.js";
import { addSeconds } from "date-fns";
import logger from "../logger.js";
import { OAuthRefreshTokenResponse } from "../types.js";

class CredentialHelper {
	private config: Config
	private orm: Orm
	private credentialId: number;

	private credential: Credential | null = null;

	constructor(config: Config, orm: Orm, credentialId: number) {
		this.config = config;
		this.orm = orm;
		this.credentialId = credentialId;
	}

	private async init(): Promise<void> {
		this.credential = await this.orm.em.findOneOrFail(Credential, this.credentialId);
	}

	private async refresh(): Promise<void> {
		if(!this.credential) {
			throw new Error('Can only refresh initialized credentials')
		}

		logger.info(`Refreshing credential ${this.credentialId}`)

		const tokenResponse = await got.post(TWITCH_TOKEN_URL, {
			form: {
				client_id: this.config.getTwitchClientId(),
				client_secret: this.config.getTwitchClientSecret(),
				grant_type: 'refresh_token',
				refresh_token: this.credential.refreshToken
			}
		}).json<OAuthRefreshTokenResponse>()

		this.credential.accessToken = tokenResponse.access_token;
		this.credential.refreshToken = tokenResponse.refresh_token;
		this.credential.expiresAt = addSeconds(new Date(), tokenResponse.expires_in - 300);

		await this.orm.em.flush()
	}

	protected async getToken(): Promise<string> {
		if(!this.credential) {
			await this.init();
		}

		if(!this.credential) {
			throw new Error('Failed to initialize')
		}

		if(this.credential.expiresAt < new Date()) {
			await this.refresh();
		}

		return this.credential.accessToken
	}

	public async getHeaders(): Promise<Headers> {
		return {
			'Client-Id': this.config.getTwitchClientId(),
			Authorization: `Bearer ${await this.getToken()}`
		}
	}

	public async validate(): Promise<void> {
		try {
			await got.get(TWITCH_VALIDATE_URL, {
				headers: {
					Authorization: `OAuth ${this.getToken()}`
				}
			})
		} catch (e) {
			if(e instanceof RequestError) {
				if(e.response?.statusCode == 401) {
					await this.refresh()
				}
			}
		}
	}
}

export default CredentialHelper
