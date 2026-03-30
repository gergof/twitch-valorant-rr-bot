import got, { Headers } from "got";
import Config from "../Config.js";
import { TWITCH_TOKEN_URL } from "../constants.js";
import { OAuthTokenResponse } from "../types.js";

class AppTokenProvider {
	private config: Config

	private token: string | null = null;
	private expiresAt: number | null = null;

	constructor(config: Config) {
		this.config = config;
	}

	private async refresh(): Promise<void> {
		const tokenResponse = await got.post(TWITCH_TOKEN_URL, {
			form: {
				client_id: this.config.getTwitchClientId(),
				client_secret: this.config.getTwitchClientSecret(),
				grant_type: 'client_credentials'
			}
		}).json<OAuthTokenResponse>()

		this.token = tokenResponse.access_token;
		this.expiresAt = Date.now() + (tokenResponse.expires_in * 1000) - 300_000;
	}

	protected async getToken(): Promise<string> {
		if(!this.token) {
			await this.refresh()
		}
		
		if(this.expiresAt && this.expiresAt < Date.now()) {
			await this.refresh()
		}

		if(!this.token){
			throw new Error('Failed to obtain token')
		}

		return this.token;
	}

	public async getHeaders(): Promise<Headers> {
		return {
			'Client-Id': this.config.getTwitchClientId(),
			Authorization: `Bearer ${await this.getToken()}`
		}
	}
}

export default AppTokenProvider