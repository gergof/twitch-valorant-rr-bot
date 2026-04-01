import { Server } from '../server.js';

const Landing = (server: Server) => {
	server.get('/', async (_req, resp) => {
		return resp.sendFile('index.html');
	});
};

export default Landing;
