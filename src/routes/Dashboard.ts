import { Static, Type } from '@sinclair/typebox';
import HttpErrors from 'http-errors';

import App from '../app/App.js';
import { Server } from '../server.js';

import isAuthenticated from './helpers/isAuthenticated.js';

const UpdateSettingsBody = Type.Object({
	active: Type.Optional(Type.String()),
	valorantAccount: Type.String()
});
type UpdateSettingsBodyType = Static<typeof UpdateSettingsBody>;

const Dashboard = (server: Server, app: App) => {
	server.get('/dashboard', async (_req, resp) => {
		return resp.redirect('/dashboard/settings');
	});

	server.get('/dashboard/login', async (req, resp) => {
		return resp.view('login');
	});

	server.get(
		'/dashboard/logout',
		isAuthenticated(async (req, resp) => {
			await req.session.destroy();

			return resp.redirect('/dashboard/login');
		})
	);

	server.get(
		'/dashboard/settings',
		isAuthenticated(async (req, resp) => {
			return resp.view('settings', { channel: req.session.channel });
		})
	);

	server.post<{ Body: UpdateSettingsBodyType }>(
		'/dashboard/settings',
		{
			schema: {
				body: UpdateSettingsBody
			}
		},
		isAuthenticated(async (req, resp) => {
			if (!req.session.channel) {
				throw new HttpErrors.Unauthorized();
			}

			req.session.channel = await app.updateChannelSettings(
				req.session.channel.id,
				{
					active: req.body.active === 'on',
					valorantAccount: req.body.valorantAccount.trim() ?? ''
				}
			);
			await req.session.save();

			return resp.redirect('/dashboard/settings');
		})
	);
};

export default Dashboard;
