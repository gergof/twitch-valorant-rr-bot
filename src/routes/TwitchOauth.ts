import { Type, Static } from "@sinclair/typebox";
import { Server } from "../server.js";
import App from "../app/App.js";
import logger from "../logger.js";
import HttpErrors from 'http-errors'
import Channel from "../models/Channel.js";

const Querystring = Type.Object({
	code: Type.Optional(Type.String()),
	state: Type.Optional(Type.String()),
	error: Type.Optional(Type.String()),
	error_description: Type.Optional(Type.String())
})
type QuerystringType = Static<typeof Querystring>

const TwitchOauth = (server: Server, app: App) => {
	server.get('/api/oauth/twitch-authorize', async (req, resp) => {
		logger.info('Redirecting user to Twitch authorization')
		return resp.redirect(app.getAuthorizationUrl());
	})

	server.get<{Querystring: QuerystringType}>('/api/oauth/twitch-cb', {
		schema: {
			querystring: Querystring
		}
	}, async (req, resp) => {
		if(req.query.error) {
			logger.warn('Twitch OAuth callback returned error', {
				error: req.query.error,
				errorDescription: req.query.error_description
			})
			return resp.view('oauth-error', {
				errorDescription: req.query.error_description ?? req.query.error
			})
		}

		if(!req.query.code) {
			logger.warn('Twitch OAuth callback missing authorization code')
			return resp.view('oauth-error', {
				errorDescription: 'Missing authorization code.'
			})
		}

		try {
			const channel = await app.authorizeUser(req.query.code)

			await req.session.regenerate()
			req.session.channel = channel;
			await req.session.save()
			logger.info('User logged in through Twitch OAuth', {
				channelId: channel.id,
				twitchId: channel.twitchId
			})

			return resp.redirect('/dashboard')
		} catch (error) {
			logger.error('Twitch OAuth callback failed', {
				error: error instanceof Error ? error.message : String(error)
			})
			return resp.view('oauth-error', {
				errorDescription: 'Authentication failed. Please try again.'
			})
		}
	})

	server.get<{Querystring: QuerystringType}>('/api/oauth/twitch-cb-bot', {
		schema: {
			querystring: Querystring
		}
	}, async req => {
		if(req.query.error) {
			logger.warn('Bot authorization callback returned error', {
				error: req.query.error,
				errorDescription: req.query.error_description
			})
		}

		if(!req.query.code || !req.query.state) {
			throw new HttpErrors.BadRequest('Malformed bot authorization URL')
		}

		await app.authorizeBotUser(req.query.code, req.query.state)
		logger.info('Bot authorization callback completed successfully')

		return 'Authorization completed'
	})
}

export default TwitchOauth
