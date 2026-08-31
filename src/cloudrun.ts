import { randomUUID } from 'crypto';
import os from 'os';

import { logger } from './common/utils/logger';
import { HOST, PORT, nativeContracts } from './config/env';
import { getPool } from './db/cloudSqlPool';
import app from './server';

// Fail fast if Cloud SQL env vars are missing (client data requires Cloud SQL)
getPool();

app.listen(PORT, HOST, () => {
  logger.info({ port: PORT, host: HOST }, 'Server listening');
});

if (nativeContracts.enabled && nativeContracts.outboxEnabled) {
  // Required lazily so disabled revisions never initialize contract workers.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const {
    contractOutboxService,
  } = require('./features/contracts/services/outboxService');
  const workerId = `${os.hostname()}:${randomUUID()}`;
  let running = false;
  const poll = async () => {
    if (running) return;
    running = true;
    try {
      const result = await contractOutboxService.processBatch(
        workerId,
        nativeContracts.outboxBatchSize
      );
      if (result.leased > 0) {
        logger.info(
          { operation: 'contract_outbox_batch', count: result.leased },
          'Processed contract outbox batch'
        );
      }
    } catch {
      logger.error(
        { operation: 'contract_outbox_batch', retryable: true },
        'Contract outbox batch failed'
      );
    } finally {
      running = false;
    }
  };
  setInterval(poll, nativeContracts.outboxPollMs).unref();
  void poll();
}
