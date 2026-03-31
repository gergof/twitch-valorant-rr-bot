import App from "../app/App.js";
import { Server } from "../server.js";
import Dashboard from "./Dashboard.js";
import Matches from "./Matches.js";
import Streams from "./Streams.js";
import TwitchOauth from "./TwitchOauth.js";

const registerRoutes = (server: Server, app: App) => {
	TwitchOauth(server, app);
	Dashboard(server, app);
	Streams(server, app);
	Matches(server, app);
}

export default registerRoutes
