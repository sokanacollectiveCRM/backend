import { NextFunction, Response, Router } from 'express';
import { z } from 'zod';

import { logger } from '../../../common/utils/logger';
import authMiddleware from '../../../middleware/authMiddleware';
import authorizeRoles from '../../../middleware/authorizeRoles';
import type { AuthRequest } from '../../../types';
import { runNotificationTick } from '../application/runNotificationTick';
import { NOTIFICATION_RULES, NotificationRuleId } from '../domain/catalog';
import { displayFirstName } from '../domain/names';
import { PostponementReason } from '../domain/postponement';
import { defaultPostponementRestart } from '../domain/time';
import { NotificationEmail } from '../infrastructure/notificationEmail';
import { NotificationStore } from '../infrastructure/notificationStore';
import { notificationTickAuthorized } from './verifyTickToken';

const postponeBody = z.object({
  clientId: z.string().uuid(),
  reason: z.enum([
    'waiting_on_paycheck',
    'waiting_on_insurance_or_medicaid',
    'other',
  ]),
  note: z.string().trim().max(500).optional(),
  restartOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

function adminOnly(req: AuthRequest, res: Response, next: NextFunction): void {
  authorizeRoles(req, res, next, ['admin']);
}

export function createNotificationTickRouter(): Router {
  const router = Router();
  router.post('/notification-tick', async (req, res) => {
    if (!(await notificationTickAuthorized(req.header('authorization')))) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    try {
      const result = await runNotificationTick();
      res.status(200).json(result);
    } catch (error) {
      logger.error(
        {
          service: 'notification-rules',
          errName: error instanceof Error ? error.name : 'Error',
          pgCode:
            typeof (error as { code?: unknown }).code === 'string'
              ? (error as { code: string }).code
              : undefined,
        },
        'Notification tick failed'
      );
      res.status(500).json({ error: 'Tick failed' });
    }
  });
  return router;
}

export function createNotificationRoutes(): Router {
  const router = Router();
  const store = new NotificationStore();
  const email = new NotificationEmail();

  router.use(authMiddleware);

  router.get('/notices', async (req: AuthRequest, res: Response) => {
    const role = String(req.user?.role || '').toLowerCase();
    if (role === 'admin') {
      res.status(200).json({ notices: await store.listNotices('admin') });
      return;
    }
    if (role === 'doula' && req.user?.id) {
      res.status(200).json({
        notices: await store.listNotices('doula', String(req.user.id)),
      });
      return;
    }
    res.status(403).json({ error: 'Forbidden' });
  });

  router.post(
    '/test-send',
    adminOnly,
    async (req: AuthRequest, res: Response) => {
      const ruleId = String(req.body?.ruleId || '');
      if (!Object.prototype.hasOwnProperty.call(NOTIFICATION_RULES, ruleId)) {
        res.status(400).json({ error: 'Unknown rule' });
        return;
      }
      const to = String(req.user?.email || '');
      if (!to) {
        res.status(400).json({ error: 'Admin email is missing' });
        return;
      }
      await email.sendRuleSample({ to, ruleId });
      res
        .status(200)
        .json({ sent: true, ruleId: ruleId as NotificationRuleId });
    }
  );

  router.post(
    '/postponements',
    adminOnly,
    async (req: AuthRequest, res: Response) => {
      const parsed = postponeBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid postponement' });
        return;
      }
      if (parsed.data.reason === 'other' && !parsed.data.note) {
        res.status(400).json({ error: 'A note is required for other' });
        return;
      }
      const { clientId, reason, note, restartOn } = parsed.data;
      if (!clientId || !reason) {
        res.status(400).json({ error: 'Invalid postponement' });
        return;
      }
      await openPostponement(
        store,
        email,
        req,
        res,
        { clientId, reason, note, restartOn },
        'active',
        'admin'
      );
    }
  );

  router.post(
    '/postponement-requests',
    (req, res, next) => authorizeRoles(req, res, next, ['doula']),
    async (req: AuthRequest, res: Response) => {
      const parsed = postponeBody.safeParse(req.body);
      if (!parsed.success || !req.user?.id) {
        res.status(400).json({ error: 'Invalid postponement request' });
        return;
      }
      const { clientId, reason, note, restartOn } = parsed.data;
      if (!clientId || !reason) {
        res.status(400).json({ error: 'Invalid postponement request' });
        return;
      }
      const assigned = await store.doulaIsAssigned(
        clientId,
        String(req.user.id)
      );
      if (!assigned) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      const id = await store.createPostponement({
        clientId,
        reason,
        note: note ?? null,
        restartOn: restartOn ?? defaultPostponementRestart(new Date()),
        status: 'requested',
        requestedByRole: 'doula',
        actorId: String(req.user.id),
      });
      const first = displayFirstName(await store.clientFirstName(clientId));
      await store.upsertNotice({
        dedupeKey: `postponement:${id}:requested`,
        audience: 'admin',
        clientId,
        severity: 'info',
        title: `Postponement requested for ${first}`,
        body: 'A doula requested a postponement. It is not active until an admin approves it.',
        ruleId: 'event_postponement',
      });
      res.status(201).json({ id, status: 'requested' });
    }
  );

  router.post(
    '/postponements/:id/approve',
    adminOnly,
    async (req: AuthRequest, res: Response) => {
      const current = await store.getPostponement(req.params.id);
      const updated = await store.updatePostponement({
        id: req.params.id,
        action: 'approved',
        actorId: String(req.user?.id || ''),
      });
      if (!updated || !current) {
        res.status(404).json({ error: 'Request not found' });
        return;
      }
      await notifyDoulaOfPostponement(
        store,
        email,
        updated.clientId,
        current.reason,
        current.restartOn
      );
      res.status(200).json({ status: 'active' });
    }
  );

  router.post(
    '/postponements/:id/lift',
    adminOnly,
    async (req: AuthRequest, res: Response) => {
      const current = await store.getPostponement(req.params.id);
      if (!current || current.status !== 'active') {
        res.status(404).json({ error: 'Postponement not found' });
        return;
      }
      const restarted = await store.restartPostponement(
        req.params.id,
        current.clientId
      );
      res.status(200).json({ status: restarted ? 'restarted' : 'active' });
    }
  );

  router.post(
    '/postponements/:id/extend',
    adminOnly,
    async (req: AuthRequest, res: Response) => {
      const restartOn = String(req.body?.restartOn || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(restartOn)) {
        res.status(400).json({ error: 'restartOn must be YYYY-MM-DD' });
        return;
      }
      const updated = await store.updatePostponement({
        id: req.params.id,
        action: 'extended',
        actorId: String(req.user?.id || ''),
        restartOn,
      });
      if (!updated) {
        res.status(404).json({ error: 'Postponement not found' });
        return;
      }
      res.status(200).json({ status: 'active', restartOn });
    }
  );

  router.post(
    '/postponements/:id/cancel',
    adminOnly,
    async (req: AuthRequest, res: Response) => {
      const updated = await store.updatePostponement({
        id: req.params.id,
        action: 'canceled',
        actorId: String(req.user?.id || ''),
      });
      if (!updated) {
        res.status(404).json({ error: 'Postponement not found' });
        return;
      }
      res.status(200).json({ status: 'canceled' });
    }
  );

  return router;
}

async function openPostponement(
  store: NotificationStore,
  email: NotificationEmail,
  req: AuthRequest,
  res: Response,
  body: {
    clientId: string;
    reason: PostponementReason;
    note?: string;
    restartOn?: string;
  },
  status: 'active',
  role: 'admin'
): Promise<void> {
  const id = await store.createPostponement({
    clientId: body.clientId,
    reason: body.reason,
    note: body.note ?? null,
    restartOn: body.restartOn ?? defaultPostponementRestart(new Date()),
    status,
    requestedByRole: role,
    actorId: String(req.user?.id || ''),
  });
  await notifyDoulaOfPostponement(
    store,
    email,
    body.clientId,
    body.reason,
    body.restartOn ?? defaultPostponementRestart(new Date())
  );
  res.status(201).json({ id, status });
}

async function notifyDoulaOfPostponement(
  store: NotificationStore,
  email: NotificationEmail,
  clientId: string,
  reason: PostponementReason,
  restartOn: string
): Promise<void> {
  const doula = await store.assignedDoula(clientId);
  if (!doula?.email) return;
  const first = displayFirstName(await store.clientFirstName(clientId));
  await email.sendPostponementToDoula({
    to: doula.email,
    clientFirstName: first,
    reason,
    restartOn,
  });
}
