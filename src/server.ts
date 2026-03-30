import Fastify from "fastify";
import FastifyView from "@fastify/view";
import Ejs from 'ejs'
import FastifyStatic from "@fastify/static";
import path from "node:path";
import url from "node:url";
import logger from "./logger.js";

const createServer = () => {
	const server = Fastify({logger: true});

	server.register(FastifyView, {
		engine: {
			ejs: Ejs
		}
	})

	server.register(FastifyStatic, {
		root: path.join(
			path.dirname(url.fileURLToPath(import.meta.url)),
			'static'	
		)
	})

	return server;
}

export type Server = ReturnType<typeof createServer>;

export default createServer;