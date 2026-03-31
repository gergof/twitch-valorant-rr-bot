import { Static, Type } from "@sinclair/typebox";
import App from "../app/App.js";
import { Server } from "../server.js";
import isAuthenticated from "./helpers/isAuthenticated.js";
import HttpErrors from 'http-errors';

const StreamsQuery = Type.Object({
	page: Type.Optional(Type.Integer({minimum: 1}))
})
type StreamsQueryType = Static<typeof StreamsQuery>

const Streams = (server: Server, app: App) => {
	server.get<{ Querystring: StreamsQueryType }>('/dashboard/streams', {
		schema: {
			querystring: StreamsQuery
		}
	}, isAuthenticated(async (req, resp) => {
		if(!req.session.channel) {
			throw new HttpErrors.Unauthorized()
		}

		const streamsPage = await app.getStreamsPage(req.session.channel.id, req.query.page ?? 1);

		return resp.view('streams', {
			channel: req.session.channel,
			streams: streamsPage.streams.map(stream => ({
				...stream,
				startedAt: stream.startedAt.toISOString(),
				endedAt: stream.endedAt?.toISOString()
			})),
			page: streamsPage.page,
			totalPages: streamsPage.totalPages,
			totalStreams: streamsPage.totalStreams
		})
	}))
}

export default Streams;
