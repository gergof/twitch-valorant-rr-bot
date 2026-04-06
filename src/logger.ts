import winston from 'winston';

const logger = winston.createLogger({
	level: 'info',
	format: winston.format.combine(
		winston.format.timestamp(),
		winston.format.json()
	),
	defaultMeta: {
		service: 'twitch-valorant-rr-bot'
	},
	transports: [new winston.transports.Console()]
});

logger.child = function () {
	return winston.loggers.get('default');
};

export default logger;
