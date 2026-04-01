import dotenv from 'dotenv';

import Config from './Config.js';
import App from './app/App.js';
import logger from './logger.js';
import createOrm from './orm.js';
import registerRoutes from './routes/index.js';
import createServer from './server.js';

const main = async () => {
	logger.info('Starting Twitch Valorant RR Bot');

	dotenv.config();

	const config = new Config();
	const orm = createOrm(config);
	const app = new App(config, orm);
	const server = await createServer(config);

	let shuttingDown = false;
	const shutdown = async (signal: 'SIGINT' | 'SIGTERM') => {
		if (shuttingDown) {
			return;
		}

		shuttingDown = true;
		logger.info('Received shutdown signal', { signal });

		try {
			await server.close();
			logger.info('Graceful shutdown completed', { signal });
			process.exit(0);
		} catch (error) {
			logger.error('Graceful shutdown failed', {
				signal,
				error: error instanceof Error ? error.message : String(error)
			});
			process.exit(1);
		}
	};

	process.once('SIGINT', () => {
		void shutdown('SIGINT');
	});
	process.once('SIGTERM', () => {
		void shutdown('SIGTERM');
	});

	if (config.getBotAuthorizationMode()) {
		logger.info(
			`Bot authorization URL: ${app.getBotUserAuthorizationUrl()}`
		);
	} else {
		await app.initialize();
		server.addHook('onClose', async () => {
			await app.shutdown();
		});
	}

	registerRoutes(server, app);

	logger.info('Start listening');
	await server.listen({
		port: config.getPort()
	});
	logger.info('Started listening');
};

main().catch(error => {
	logger.error('Application failed to start', {
		error: error instanceof Error ? error.message : String(error)
	});
	process.exit(1);
});
