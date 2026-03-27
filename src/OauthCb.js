import Fastify from 'fastify';

class OauthCb {
	twitchAuth;
	server = Fastify()

	constructor(twitchAuth) {
		this.twitchAuth = twitchAuth;
		this.server.get('/twitch-cb', async (req) => {
			await this.twitchAuth.exchangeToken(req.query.code);

			return {ok: true}
		})
	}

	startServer() {
		this.server.listen({port: 3000})
	}
}

export default OauthCb;