import app from './server';
import { logger } from './common/utils/logger';
import { PORT, HOST } from './config/env';

app.listen(PORT, HOST, () => {
  logger.info({ port: PORT, host: HOST }, 'Server listening');
});
