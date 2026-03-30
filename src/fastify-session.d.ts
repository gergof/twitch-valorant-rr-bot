import '@fastify/session';
import 'fastify';
import Channel from './models/Channel.js';

declare module 'fastify' {
	interface Session {
		channel?: Channel;
	}
}
