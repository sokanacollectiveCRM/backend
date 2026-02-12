import app from './server';
import { logger } from './common/utils/logger';
import { PORT, HOST } from './config/env';
import { getPool } from './db/cloudSqlPool';

// Fail fast if Cloud SQL env vars are missing (client data requires Cloud SQL)
getPool();

app.listen(PORT, HOST, () => {
  logger.info({ port: PORT, host: HOST }, 'Server listening');
});
