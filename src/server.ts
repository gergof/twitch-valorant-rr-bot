import Fastify from "fastify";
import FastifyCookie from "@fastify/cookie";
import FastifyFormbody from "@fastify/formbody";
import FastifySession from "@fastify/session";
import FastifyView from "@fastify/view";
import { RedisStore } from "connect-redis";
import Ejs from 'ejs'
import FastifyStatic from "@fastify/static";
import path from "node:path";
import url from "node:url";
import { createClient } from "redis";
import Config from "./Config.js";
import logger from "./logger.js";

const createServer = async (config: Config) => {
	const server = Fastify({logger: true});
	const redisClient = createClient({
		url: config.getRedisUrl()
	});

	logger.info('Connecting to Redis')
	await redisClient.connect();
	logger.info('Connected to Redis')

	server.addHook('onClose', async () => {
		logger.info('Closing Redis connection')
		await redisClient.quit();
	})

	server.register(FastifyCookie);
	server.register(FastifyFormbody);

	server.register(FastifySession, {
		secret: config.getSessionSecret(),
		cookie: {
			httpOnly: true,
			maxAge: config.getSessionTtlMs(),
			path: '/',
			sameSite: 'lax',
			secure: 'auto'
		},
		saveUninitialized: false,
		store: new RedisStore({
			client: redisClient,
			prefix: 'session:',
			ttl: Math.ceil(config.getSessionTtlMs() / 1000)
		})
	});

	server.register(FastifyView, {
		root: path.join(
			path.dirname(url.fileURLToPath(import.meta.url)),
			'routes/views'	
		),
		engine: {
			ejs: Ejs
		}
	})

	server.register(FastifyStatic, {
		root: path.join(
			path.dirname(url.fileURLToPath(import.meta.url)),
			'static'	
		),
		prefix: '/static/'
	})

	logger.info('HTTP server plugins registered')

	return server;
}

export type Server = Awaited<ReturnType<typeof createServer>>;

export default createServer;
