import { Migrator } from '@mikro-orm/migrations';
import { defineConfig } from '@mikro-orm/postgresql';
import dotenv from 'dotenv';

import Config from './Config.js';
import models from './models/index.js';

dotenv.config();
const config = new Config();

export default defineConfig({
	entities: models,
	extensions: [Migrator],
	dbName: config.getDbName(),
	host: config.getDbHost(),
	user: config.getDbUser(),
	password: config.getDbPassword()
});
