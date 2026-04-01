import { defineConfig } from "@mikro-orm/postgresql";
import { Migrator } from "@mikro-orm/migrations";
import dotenv from 'dotenv';

import Config from "./dist/Config.js";
import models from "./dist/models/index.js";

dotenv.config()
const config = new Config()

export default defineConfig({
	entities: models,
	extensions: [Migrator],
	dbName: config.getDbName(),
	host: config.getDbHost(),
	user: config.getDbUser(),
	password: config.getDbPassword()
})
