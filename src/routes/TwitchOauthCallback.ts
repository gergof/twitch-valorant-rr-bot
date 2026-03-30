import { Type, Static } from "@sinclair/typebox";
import { Server } from "../server.js";

const Querystring = Type.Object({
	code: Type.Optional(Type.String()),
	error: Type.Optional(Type.String())
})

const TwitchOauthCallback = (server: Server) => {
	server.get<{Querystring: Static<typeof Querystring>}>('/api/twitch-callback', {
		schema: {
			querystring: Querystring
		}
	}, async req => {
		
	})
}