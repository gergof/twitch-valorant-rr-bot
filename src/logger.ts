import winston from 'winston';

const timestamp = winston.format(info => {
	info.time = Date.now();

	return info;
});

const logger = winston.createLogger({
	level: 'info',
	format: winston.format.combine(timestamp(), winston.format.json()),
	defaultMeta: {
		service: 'twitch-valorant-rr-bot'
	},
	transports: [new winston.transports.Console()]
});

logger.child = function () {
	return winston.loggers.get('default');
};

export default logger;
