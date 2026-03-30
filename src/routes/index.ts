import App from "../app/App.js";
import { Server } from "../server.js";
import TwitchOauth from "./TwitchOauth.js";

const registerRoutes = (server: Server, app: App) => {
	TwitchOauth(server, app);
}

export default registerRoutes