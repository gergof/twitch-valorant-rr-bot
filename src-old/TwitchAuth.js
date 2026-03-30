import got from 'got';

class TwitchAuth {
	clientId;
	clientSecret;

	user = null;
	token = null;
	refreshToken = null;
	tokenExpiration = null;

	constructor(clientId, clientSecret) {
		this.clientId = clientId;
		this.clientSecret = clientSecret;
	}

	getAuthorizationUrl() {
		const url = new URL('https://id.twitch.tv/oauth2/authorize');
		url.searchParams.set('client_id', this.clientId);
		url.searchParams.set('redirect_uri', 'http://localhost:3000/twitch-cb');
		url.searchParams.set('response_type', 'code');
		url.searchParams.set('scope', 'user:write:chat')

		return url.toString()
	}

	storeToken(resp) {
		this.token = `Bearer ${resp.access_token}`
		this.refreshToken = resp.refresh_token;
		this.tokenExpiration = Date.now() + (resp.expires_in * 1000) + 300_000
	}

	async exchangeToken(code) {
		const resp = await got.post('https://id.twitch.tv/oauth2/token', {
			form: {
				client_id: this.clientId,
				client_secret: this.clientSecret,
				grant_type: 'authorization_code',
				code: code,
				redirect_uri: 'http://localhost:3000/twitch-cb'
			}
		}).json()

		this.storeToken(resp);

		const user = await got.get('https://id.twitch.tv/oauth2/validate', {
			headers: {
				Authorization: this.token.replace('Bearer', 'OAuth')
			}
		}).json();

		this.user = user.user_id;

	}

	isConfigured() {
		return !!this.user;
	}

	async getToken() {
		if(!this.token) {
			throw new Error('Not set up!')
		}

		if(this.tokenExpiration < Date.now()) {
			const resp = await got.post('https://id.twitch.tv/oauth2/token', {
				form: {
					client_id: this.clientId,
					client_secret: this.clientSecret,
					grant_type: 'refresh_token',
					refresh_token: this.refreshToken
				}
			}).json();

			this.storeToken(resp);
		}

		return this.token;
	}

	async getHeaders() {
		return {
			Authorization: await this.getToken(),
			'Client-Id': this.clientId
		}
	}
}

export default TwitchAuth;