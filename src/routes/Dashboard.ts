import App from "../app/App.js";
import { Server } from "../server.js";
import isAuthenticated from "./helpers/isAuthenticated.js";

const Dashboard = (server: Server, app: App) => {
	server.get('/dashboard', isAuthenticated(async (_req, resp) => {
		return resp.redirect('/dashboard/settings')
	}))

	server.get('/dashboard/login', async (req, resp) => {
		return resp.view('login')
	})

	server.get('/dashboard/logout', isAuthenticated(async (req, resp) => {
		await req.session.destroy()

		return resp.redirect('/dashboard/login')
	}))

	server.get('/dashboard/settings', isAuthenticated(async (req, resp) => {
		return resp.view('settings', {channel: req.session.channel})
	}))
}

export default Dashboard;
