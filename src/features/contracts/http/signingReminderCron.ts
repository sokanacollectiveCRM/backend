import { createHash, timingSafeEqual } from 'crypto';
import { Router } from 'express';

import { logger } from '../../../common/utils/logger';
import { nativeContracts } from '../../../config/env';
import { queryCloudSql } from '../../../db/cloudSqlPool';

const HEADER = 'x-cron-secret';
const ACTOR = 'system:signing-reminder-cron';
const MAX_PER_RUN = 20;

export function cronSecretMatches(
  expected: string | undefined,
  provided: string | undefined
): boolean {
  const left = createHash('sha256')
    .update(expected ?? '')
    .digest();
  const right = createHash('sha256')
    .update(provided ?? '')
    .digest();
  return Boolean(expected) && timingSafeEqual(left, right);
}

export function createSigningReminderCronRouter(): Router {
  const router = Router();

  router.post('/signing-reminders', async (req, res) => {
    if (
      !cronSecretMatches(
        process.env.CRON_SIGNING_REMINDER_SECRET,
        req.header(HEADER) ?? undefined
      )
    ) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!nativeContracts.enabled) {
      res.status(200).json({ reminded: 0, skipped: true });
      return;
    }

    const { rows } = await queryCloudSql<{ id: string }>(
      `
      SELECT c.id
      FROM public.phi_contracts c
      JOIN public.signing_invitations i ON i.contract_id = c.id
      WHERE c.status IN ('sent', 'viewed', 'partially_signed')
        AND i.revoked_at IS NULL
        AND i.completed_at IS NULL
        AND i.expires_at > CURRENT_TIMESTAMP
        AND i.created_at < CURRENT_TIMESTAMP - INTERVAL '1 day'
      ORDER BY i.created_at ASC
      LIMIT $1
      `,
      [MAX_PER_RUN]
    );

    // Required lazily so this route can load when native contracts are off.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { nativeContractService } = require('../composition');
    let reminded = 0;
    let failed = 0;
    for (const row of rows) {
      try {
        await nativeContractService.send(row.id, ACTOR, true);
        reminded += 1;
      } catch (error) {
        failed += 1;
        logger.error(
          {
            service: 'signing-reminder-cron',
            operation: 'remind',
            contractId: row.id,
            err: error instanceof Error ? error.name : 'Error',
          },
          'Signing reminder failed'
        );
      }
    }

    res.status(200).json({ reminded, failed, checked: rows.length });
  });

  return router;
}
