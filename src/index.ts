import createApp from "./app/App.js"
import Config from "./Config.js"
import logger from "./logger.js"
import createOrm from "./orm.js"
import createServer from "./server.js"

const main = async () => {
	logger.info('Starting Twitch Valorant RR Bot')

	const config = new Config();
	const orm = createOrm(config);
	const app = createApp(orm);

	const server = createServer()

	logger.info('Start listening')
	await server.listen({
		port: config.getPort()
	})
	logger.info('Started listening')
}

main()