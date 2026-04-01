import { Static, Type } from '@sinclair/typebox';
import HttpErrors from 'http-errors';

import App from '../app/App.js';
import { Server } from '../server.js';

import isAuthenticated from './helpers/isAuthenticated.js';

const MatchesQuery = Type.Object({
	page: Type.Optional(Type.Integer({ minimum: 1 }))
});
type MatchesQueryType = Static<typeof MatchesQuery>;

const Matches = (server: Server, app: App) => {
	server.get<{ Querystring: MatchesQueryType }>(
		'/dashboard/matches',
		{
			schema: {
				querystring: MatchesQuery
			}
		},
		isAuthenticated(async (req, resp) => {
			if (!req.session.channel) {
				throw new HttpErrors.Unauthorized();
			}

			const matchesPage = await app.getMatchesPage(
				req.session.channel.id,
				req.query.page ?? 1
			);

			return resp.view('matches', {
				channel: req.session.channel,
				matches: matchesPage.matches.map(match => ({
					...match,
					createdAt: match.createdAt.toISOString()
				})),
				page: matchesPage.page,
				totalPages: matchesPage.totalPages,
				totalMatches: matchesPage.totalMatches
			});
		})
	);
};

export default Matches;
