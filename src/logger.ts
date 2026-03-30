import winston from 'winston';

const logger = winston.createLogger({
	level: 'info',
	format: winston.format.json(),
	defaultMeta: {
		service: 'twitch-valorant-rr-bot'
	},
	transports: [
		new winston.transports.Console()
	]
})

export default logger;