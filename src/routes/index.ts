import App from "../app/App.js";
import { Server } from "../server.js";
import Dashboard from "./Dashboard.js";
import Streams from "./Streams.js";
import TwitchOauth from "./TwitchOauth.js";

const registerRoutes = (server: Server, app: App) => {
	TwitchOauth(server, app);
	Dashboard(server, app);
	Streams(server, app);
}

export default registerRoutes
