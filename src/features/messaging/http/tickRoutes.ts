import { Router } from 'express';

import { ReminderEngine } from '../application/reminderEngine';
import { OidcVerifier, requireReminderCronOidc } from './oidcAuth';

export function createReminderTickRoutes(
  engine: ReminderEngine,
  verify?: OidcVerifier
): Router {
  const router = Router();
  router.post(
    '/cron/reminders/tick',
    requireReminderCronOidc(verify),
    async (_req, res) => {
      const result = await engine.tick();
      res.json(result);
    }
  );
  return router;
}
