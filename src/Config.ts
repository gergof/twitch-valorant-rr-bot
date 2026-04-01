import env from 'env-var';

class Config {
	private twitchClientId: string;
	private twitchClientSecret: string;
	private valorantApiKey: string;

	private botAuthorizationMode: boolean;

	private redisUrl: string;
	private sessionSecret: string;
	private sessionTtlMs: number;

	private dbHost: string;
	private dbUser: string;
	private dbPassword: string;
	private dbName: string;

	private publicUrl: string;
	private port: number;

	constructor() {
		this.twitchClientId = env.get('TWITCH_CLIENT_ID').required().asString()
		this.twitchClientSecret = env.get('TWITCH_CLIENT_SECRET').required().asString()
		this.valorantApiKey = env.get('VALORANT_API_KEY').required().asString()

		this.botAuthorizationMode = env.get('BOT_AUTHORIZATION_MODE').default('false').asBool()

		this.redisUrl = env.get('REDIS_URL').required().asString()
		this.sessionSecret = env.get('SESSION_SECRET').required().asString()
		this.sessionTtlMs = env.get('SESSION_TTL_MS').default('86400000').asIntPositive()

		this.dbHost = env.get('DB_HOST').required().asString();
		this.dbUser = env.get('DB_USER').required().asString();
		this.dbPassword = env.get('DB_PASSWORD').required().asString();
		this.dbName = env.get('DB_NAME').required().asString();

		this.publicUrl = env.get('PUBLIC_URL').required().asUrlString();
		this.port = env.get('PORT').required().asPortNumber();
	}

	getTwitchClientId() {
		return this.twitchClientId
	}

	getTwitchClientSecret() {
		return this.twitchClientSecret
	}

	getValorantApiKey() {
		return this.valorantApiKey
	}

	getBotAuthorizationMode() {
		return this.botAuthorizationMode;
	}

	getRedisUrl() {
		return this.redisUrl
	}

	getSessionSecret() {
		return this.sessionSecret
	}

	getSessionTtlMs() {
		return this.sessionTtlMs
	}

	getDbHost() {
		return this.dbHost;
	}

	getDbUser() {
		return this.dbUser;
	}

	getDbPassword() {
		return this.dbPassword;
	}

	getDbName() {
		return this.dbName;
	}

	getPublicUrl() {
		return this.publicUrl;
	}

	getPort() {
		return this.port;
	}
}

export default Config;
