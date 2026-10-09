import { NextFunction, Request, Response, Router } from 'express';
import { ZodError, z } from 'zod';

import authMiddleware from '../../../middleware/authMiddleware';
import authorizeRoles from '../../../middleware/authorizeRoles';
import { ApiResponse } from '../../../utils/responseBuilder';
import { PostponementService } from '../application/postponementService';
import { ReminderEngine } from '../application/reminderEngine';
import { ReminderStore } from '../application/reminderStore';
import { unknownMergeFields } from '../domain/mergeFields';
import {
  CHANNELS,
  DELAY_UNITS,
  END_ACTIONS,
  POSTPONEMENT_REASONS,
  RECIPIENT_ROLES,
} from '../domain/types';

type Authed = Request & {
  user?: { id?: string; email?: string; role?: string };
};

function actorId(req: Authed): string {
  return String(req.user?.id || '');
}

function parseFilter(query: Request['query']) {
  return {
    status: typeof query.status === 'string' ? query.status : undefined,
    policyKey:
      typeof query.policy_key === 'string' ? query.policy_key : undefined,
    clientId: typeof query.client_id === 'string' ? query.client_id : undefined,
    contractId:
      typeof query.contract_id === 'string' ? query.contract_id : undefined,
    page: query.page ? Number(query.page) : 1,
    pageSize: query.page_size ? Number(query.page_size) : 20,
    acknowledged:
      query.acknowledged === 'true'
        ? true
        : query.acknowledged === 'false'
          ? false
          : undefined,
  };
}

const stepSchema = z.object({
  step_order: z.number().int().positive(),
  delay_value: z.number().int().min(0),
  delay_unit: z.enum(DELAY_UNITS),
  repeat_every_value: z.number().int().positive().nullable().optional(),
  repeat_every_unit: z.enum(DELAY_UNITS).nullable().optional(),
  channel: z.enum(CHANNELS),
  recipient_roles: z.array(z.enum(RECIPIENT_ROLES)).min(1),
  template_id: z.string().uuid(),
  enabled: z.boolean(),
});

export function createAdminMessagingRoutes(input: {
  store: ReminderStore;
  engine: ReminderEngine;
  postponements: PostponementService;
  testToolsEnabled: boolean;
}): Router {
  const { store, engine, postponements, testToolsEnabled } = input;
  const router = Router();
  router.use(authMiddleware);
  router.use((req, res, next) => authorizeRoles(req, res, next, ['admin']));

  router.get('/messaging/policies', async (_req, res) => {
    const rows = await store.listPolicies();
    res.json(ApiResponse.list(rows, rows.length));
  });

  router.get('/messaging/policies/:id', async (req, res) => {
    const row = await store.getPolicy(req.params.id);
    if (!row) {
      res.status(404).json(ApiResponse.error('Policy not found', 'NOT_FOUND'));
      return;
    }
    res.json(ApiResponse.success(row));
  });

  router.patch('/messaging/policies/:id', async (req, res) => {
    const body = z
      .object({
        name: z.string().min(1).optional(),
        description: z.string().nullable().optional(),
        enabled: z.boolean().optional(),
        stop_conditions: z.object({ rules: z.array(z.any()) }).optional(),
        end_action: z.enum(END_ACTIONS).nullable().optional(),
        end_action_delay_value: z.number().int().min(0).nullable().optional(),
        end_action_delay_unit: z.enum(DELAY_UNITS).nullable().optional(),
        end_action_template_keys: z.array(z.string()).optional(),
        notify_admin_email: z.boolean().optional(),
        alert_admin_after_sends: z
          .number()
          .int()
          .positive()
          .nullable()
          .optional(),
        config: z.record(z.unknown()).optional(),
      })
      .parse(req.body);
    const row = await store.updatePolicy(
      req.params.id,
      body as any,
      actorId(req)
    );
    if (!row) {
      res.status(404).json(ApiResponse.error('Policy not found', 'NOT_FOUND'));
      return;
    }
    res.json(ApiResponse.success(row));
  });

  router.put('/messaging/policies/:id/steps', async (req, res) => {
    const body = z
      .object({ steps: z.array(stepSchema).min(1) })
      .parse(req.body);
    const row = await store.replaceSteps(
      req.params.id,
      body.steps.map((step) => ({
        step_order: step.step_order,
        delay_value: step.delay_value,
        delay_unit: step.delay_unit,
        repeat_every_value: step.repeat_every_value ?? null,
        repeat_every_unit: step.repeat_every_unit ?? null,
        channel: step.channel,
        recipient_roles: step.recipient_roles,
        template_id: step.template_id,
        enabled: step.enabled,
      })),
      actorId(req)
    );
    if (!row) {
      res.status(404).json(ApiResponse.error('Policy not found', 'NOT_FOUND'));
      return;
    }
    res.json(ApiResponse.success(row));
  });

  router.get('/messaging/templates', async (_req, res) => {
    const rows = await store.listTemplates();
    res.json(ApiResponse.list(rows, rows.length));
  });

  router.get('/messaging/templates/:id', async (req, res) => {
    const row = await store.getTemplate(req.params.id);
    if (!row) {
      res
        .status(404)
        .json(ApiResponse.error('Template not found', 'NOT_FOUND'));
      return;
    }
    res.json(ApiResponse.success(row));
  });

  router.patch('/messaging/templates/:id', async (req, res) => {
    const body = z
      .object({
        name: z.string().min(1).optional(),
        channel: z.enum(CHANNELS).optional(),
        subject: z.string().min(1).optional(),
        body_text: z.string().min(1).optional(),
        body_html: z.string().nullable().optional(),
      })
      .parse(req.body);
    const unknown = unknownMergeFields(
      body.subject,
      body.body_text,
      body.body_html
    );
    if (unknown.length) {
      res
        .status(400)
        .json(
          ApiResponse.error(
            `Unknown merge fields: ${unknown.join(', ')}`,
            'VALIDATION_ERROR'
          )
        );
      return;
    }
    const row = await store.updateTemplate(req.params.id, body, actorId(req));
    if (!row) {
      res
        .status(404)
        .json(ApiResponse.error('Template not found', 'NOT_FOUND'));
      return;
    }
    res.json(ApiResponse.success(row));
  });

  router.post('/messaging/templates/:id/preview', async (req, res) => {
    const sample = (req.body?.sample || {}) as Record<string, string>;
    const rendered = await engine.renderTemplate(req.params.id, sample);
    if (!rendered) {
      res
        .status(404)
        .json(ApiResponse.error('Template not found', 'NOT_FOUND'));
      return;
    }
    res.json(ApiResponse.success(rendered));
  });

  router.post('/messaging/templates/:id/test-send', async (req, res) => {
    const email = req.user && (req as Authed).user?.email;
    if (!email) {
      res
        .status(400)
        .json(ApiResponse.error('Admin email missing', 'VALIDATION_ERROR'));
      return;
    }
    const template = await store.getTemplate(req.params.id);
    if (!template) {
      res
        .status(404)
        .json(ApiResponse.error('Template not found', 'NOT_FOUND'));
      return;
    }
    const rendered = await engine.renderTemplate(
      req.params.id,
      req.body?.sample || {}
    );
    if (!rendered) {
      res
        .status(404)
        .json(ApiResponse.error('Template not found', 'NOT_FOUND'));
      return;
    }
    const { NodemailerService } = require('../../../services/emailService');
    const mailer = new NodemailerService();
    await mailer.sendEmail(
      email,
      rendered.subject,
      rendered.text,
      rendered.html
    );
    await store.tryInsertSendLog({
      runId: null,
      policyKey: 'test_send',
      stepOrder: null,
      templateKey: template.key,
      templateVersion: template.version,
      idempotencyKey: `test:${actorId(req)}:${template.id}:${Date.now()}`,
      recipientRole: 'admin',
      recipientEmail: email,
      channel: 'email',
      status: 'test',
    });
    res.json(ApiResponse.success({ sent: true, to: email }));
  });

  router.get('/messaging/runs', async (req, res) => {
    const result = await store.listRuns(parseFilter(req.query));
    res.json(
      ApiResponse.list(result.rows, result.total, {
        test_tools_enabled: testToolsEnabled,
      })
    );
  });

  router.get('/messaging/send-log', async (req, res) => {
    const result = await store.listSendLog(parseFilter(req.query));
    res.json(ApiResponse.list(result.rows, result.total));
  });

  router.get('/messaging/settings', async (_req, res) => {
    const settings = await store.getSettings();
    res.json(
      ApiResponse.success({
        ...settings,
        test_tools_enabled: testToolsEnabled,
      })
    );
  });

  router.patch('/messaging/settings', async (req, res) => {
    const body = z
      .object({
        reminders_enabled: z.boolean().optional(),
        test_recipient_override_email: z.string().email().nullable().optional(),
        contact_email: z.string().email().optional(),
        admin_notification_email: z.string().email().optional(),
        billing_notification_email: z.string().email().optional(),
        evaluation_link: z.string().url().nullable().optional(),
      })
      .parse(req.body);
    const settings = await store.updateSettings(body, actorId(req));
    res.json(
      ApiResponse.success({ ...settings, test_tools_enabled: testToolsEnabled })
    );
  });

  router.get('/messaging/alerts', async (req, res) => {
    const result = await store.listAlerts(parseFilter(req.query));
    res.json(ApiResponse.list(result.rows, result.total));
  });

  router.post('/messaging/alerts/:id/ack', async (req, res) => {
    const row = await store.ackAlert(req.params.id, actorId(req));
    if (!row) {
      res.status(404).json(ApiResponse.error('Alert not found', 'NOT_FOUND'));
      return;
    }
    res.json(ApiResponse.success(row));
  });

  router.post('/contracts/:id/reminders/stop', async (req, res) => {
    const reason =
      typeof req.body?.reason === 'string' ? req.body.reason : undefined;
    const count = await engine.stopContractReminders(req.params.id, reason);
    res.json(ApiResponse.success({ stopped: count }));
  });

  router.post('/contracts/:id/reminders/resume', async (req, res) => {
    const count = await engine.resumeContractReminders(req.params.id);
    res.json(ApiResponse.success({ resumed: count }));
  });

  router.get('/clients/:id/postponements', async (req, res) => {
    const rows = await postponements.list(req.params.id);
    res.json(ApiResponse.list(rows, rows.length));
  });

  router.post('/clients/:id/postponements', async (req, res) => {
    const body = z
      .object({
        contract_id: z.string().uuid().nullable().optional(),
        reason_code: z.enum(POSTPONEMENT_REASONS),
        reason_note: z.string().nullable().optional(),
        restart_at: z.string().datetime().optional(),
      })
      .parse(req.body);
    const result = await postponements.create({
      clientId: req.params.id,
      contractId: body.contract_id,
      reasonCode: body.reason_code,
      reasonNote: body.reason_note,
      restartAt: body.restart_at ? new Date(body.restart_at) : null,
      actorId: actorId(req),
    });
    res.status(201).json(ApiResponse.success(result));
  });

  router.post('/postponements/:id/approve', async (req, res) => {
    const row = await postponements.approve(req.params.id, actorId(req));
    if (!row) {
      res
        .status(404)
        .json(ApiResponse.error('Postponement not found', 'NOT_FOUND'));
      return;
    }
    res.json(ApiResponse.success(row));
  });

  router.post('/postponements/:id/lift', async (req, res) => {
    const row = await postponements.lift(req.params.id, actorId(req));
    if (!row) {
      res
        .status(404)
        .json(ApiResponse.error('Postponement not found', 'NOT_FOUND'));
      return;
    }
    res.json(ApiResponse.success(row));
  });

  router.post('/postponements/:id/extend', async (req, res) => {
    const body = z
      .object({ restart_at: z.string().datetime() })
      .parse(req.body);
    const result = await postponements.extend(
      req.params.id,
      new Date(body.restart_at),
      actorId(req)
    );
    if (!result.postponement) {
      res
        .status(404)
        .json(ApiResponse.error('Postponement not found', 'NOT_FOUND'));
      return;
    }
    res.json(ApiResponse.success(result));
  });

  router.post('/postponements/:id/cancel', async (req, res) => {
    const row = await postponements.cancel(req.params.id, actorId(req));
    if (!row) {
      res
        .status(404)
        .json(ApiResponse.error('Postponement not found', 'NOT_FOUND'));
      return;
    }
    res.json(ApiResponse.success(row));
  });

  const testTools: Router = Router();
  testTools.use((req, res, next) => {
    if (!testToolsEnabled) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    next();
  });
  testTools.post('/messaging/tick-now', async (_req, res) => {
    res.json(ApiResponse.success(await engine.tick()));
  });
  testTools.post('/messaging/runs/:id/advance', async (req, res) => {
    res.json(ApiResponse.success(await engine.advanceRun(req.params.id)));
  });
  router.use(testTools);

  router.use(
    (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
      if (error instanceof ZodError) {
        res
          .status(400)
          .json(ApiResponse.error('Invalid request', 'VALIDATION_ERROR'));
        return;
      }
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  );

  return router;
}
