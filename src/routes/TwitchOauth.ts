import { Type, Static } from "@sinclair/typebox";
import { Server } from "../server.js";
import App from "../app/App.js";
import logger from "../logger.js";
import HttpErrors from 'http-errors'

const Querystring = Type.Object({
	code: Type.Optional(Type.String()),
	state: Type.Optional(Type.String()),
	error: Type.Optional(Type.String())
})
type QuerystringType = Static<typeof Querystring>

const TwitchOauth = (server: Server, app: App) => {
	server.get('/api/oauth/twitch-authorize', async (req, resp) => {
		return resp.redirect(app.getAuthorizationUrl());
	})

	server.get<{Querystring: QuerystringType}>('/api/oauth/twitch-cb', {
		schema: {
			querystring: Querystring
		}
	}, async req => {
		if(req.query.error) {
			return 'had error'
		}

		if(!req.query.code) {
			return 'no code'
		}

		try {
			await app.authorizeUser(req.query.code)

			return 'ok!'
		} catch {
			return 'internal error'
		}
	})

	server.get<{Querystring: QuerystringType}>('/api/oauth/twitch-cb-bot', {
		schema: {
			querystring: Querystring
		}
	}, async req => {
		if(req.query.error) {
			logger.info('Bot authorization failed')
		}

		if(!req.query.code || !req.query.state) {
			return HttpErrors.BadRequest('Malformed bot authorization URL')
		}

		await app.authorizeBotUser(req.query.code, req.query.state)

		return 'Authorization completed'
	})
}

export default TwitchOauth