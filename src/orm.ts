import { Migrator } from '@mikro-orm/migrations';
import { MikroORM } from '@mikro-orm/postgresql';

import Config from './Config.js';
import models from './models/index.js';

const createOrm = (config: Config) => {
	return new MikroORM({
		entities: models,
		extensions: [Migrator],
		dbName: config.getDbName(),
		host: config.getDbHost(),
		user: config.getDbUser(),
		password: config.getDbPassword()
	});
};

export type Orm = ReturnType<typeof createOrm>;

export default createOrm;
