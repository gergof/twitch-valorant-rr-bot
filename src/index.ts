import Config from "./Config.js"
import logger from "./logger.js"
import createOrm from "./orm.js"
import registerRoutes from "./routes/index.js"
import createServer from "./server.js"
import App from "./app/App.js"
import dotenv from 'dotenv';

const main = async () => {
	logger.info('Starting Twitch Valorant RR Bot')

	dotenv.config()

	const config = new Config();
	const orm = createOrm(config);
	const app = new App(config, orm);
	const server = await createServer(config)

	if(config.getBotAuthorizationMode()) {
		logger.info(`Bot authorization URL: ${app.getBotUserAuthorizationUrl()}`)
	} else {
		await app.initialize()
		server.addHook('onClose', async () => {
			await app.shutdown()
		})
	}

	registerRoutes(server, app);

	logger.info('Start listening')
	await server.listen({
		port: config.getPort()
	})
	logger.info('Started listening')
}

main()
