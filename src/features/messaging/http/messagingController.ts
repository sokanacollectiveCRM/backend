import { Response } from 'express';
import { z } from 'zod';

import { ApiErrorCode } from '../../../security/errorCodes';
import type { AuthRequest } from '../../../types';
import { ApiResponse } from '../../../utils/responseBuilder';
import { unknownMergeFields } from '../domain/mergeFields';
import {
  CHANNELS,
  DELAY_UNITS,
  END_ACTIONS,
  POSTPONEMENT_REASON_CODES,
  RECIPIENT_ROLES,
} from '../domain/types';
import { PostponementService } from '../application/postponementService';
import { ReminderEngine } from '../application/reminderEngine';
import { MessagingStore } from '../application/store';

const uuidSchema = z.string().uuid();

export class MessagingController {
  constructor(
    private readonly store: MessagingStore,
    private readonly engine: ReminderEngine,
    private readonly postponements: PostponementService,
    private readonly email: {
      sendEmail(
        to: string,
        subject: string,
        text: string,
        html?: string
      ): Promise<void>;
    }
  ) {}

  listPolicies = async (_req: AuthRequest, res: Response): Promise<void> => {
    const policies = await this.store.listPolicies();
    res.json(ApiResponse.list(policies, policies.length));
  };

  getPolicy = async (req: AuthRequest, res: Response): Promise<void> => {
    const policy = await this.store.getPolicyById(String(req.params.id));
    if (!policy) {
      res.status(404).json(ApiResponse.error('Policy not found', ApiErrorCode.NOT_FOUND));
      return;
    }
    res.json(ApiResponse.success(policy));
  };

  patchPolicy = async (req: AuthRequest, res: Response): Promise<void> => {
    const body = z
      .object({
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        enabled: z.boolean().optional(),
        stopConditions: z.array(z.string()).optional(),
        endAction: z.enum(END_ACTIONS).optional(),
        endActionDelayValue: z.number().int().nonnegative().nullable().optional(),
        endActionDelayUnit: z.enum(DELAY_UNITS).nullable().optional(),
        endActionTemplateKeys: z.array(z.string()).optional(),
        notifyAdminEmail: z.boolean().optional(),
        alertAdminAfterSends: z.number().int().positive().nullable().optional(),
        config: z.record(z.unknown()).optional(),
      })
      .parse(req.body);
    const policy = await this.store.updatePolicy(String(req.params.id), {
      ...body,
      updatedBy: req.user?.id ?? null,
    });
    res.json(ApiResponse.success(policy));
  };

  replaceSteps = async (req: AuthRequest, res: Response): Promise<void> => {
    const body = z
      .object({
        steps: z.array(
          z.object({
            stepOrder: z.number().int().nonnegative(),
            delayValue: z.number().int().nonnegative(),
            delayUnit: z.enum(DELAY_UNITS),
            repeatEveryValue: z.number().int().positive().nullable().optional(),
            repeatEveryUnit: z.enum(DELAY_UNITS).nullable().optional(),
            channel: z.enum(CHANNELS),
            recipientRoles: z.array(z.enum(RECIPIENT_ROLES)).min(1),
            templateId: z.string().uuid(),
            enabled: z.boolean().default(true),
          })
        ),
      })
      .parse(req.body);
    const steps = await this.store.replaceSteps(
      String(req.params.id),
      body.steps.map((step) => ({
        stepOrder: step.stepOrder,
        delayValue: step.delayValue,
        delayUnit: step.delayUnit,
        repeatEveryValue: step.repeatEveryValue ?? null,
        repeatEveryUnit: step.repeatEveryUnit ?? null,
        channel: step.channel,
        recipientRoles: step.recipientRoles,
        templateId: step.templateId,
        enabled: step.enabled ?? true,
      }))
    );
    res.json(ApiResponse.list(steps, steps.length));
  };

  listTemplates = async (_req: AuthRequest, res: Response): Promise<void> => {
    const templates = await this.store.listTemplates();
    res.json(ApiResponse.list(templates, templates.length));
  };

  getTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
    const template = await this.store.getTemplateById(String(req.params.id));
    if (!template) {
      res
        .status(404)
        .json(ApiResponse.error('Template not found', ApiErrorCode.NOT_FOUND));
      return;
    }
    res.json(ApiResponse.success(template));
  };

  patchTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
    const body = z
      .object({
        name: z.string().min(1).optional(),
        channel: z.enum(CHANNELS).optional(),
        subject: z.string().optional(),
        bodyText: z.string().optional(),
        bodyHtml: z.string().optional(),
      })
      .parse(req.body);
    const unknown = unknownMergeFields(
      body.subject ?? '',
      body.bodyText ?? '',
      body.bodyHtml ?? ''
    );
    if (unknown.length) {
      res.status(400).json(
        ApiResponse.error(
          `Unknown merge fields: ${unknown.join(', ')}`,
          ApiErrorCode.VALIDATION_ERROR
        )
      );
      return;
    }
    const template = await this.store.updateTemplate(String(req.params.id), {
      ...body,
      updatedBy: req.user?.id ?? null,
    });
    res.json(ApiResponse.success(template));
  };

  previewTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
    const template = await this.store.getTemplateById(String(req.params.id));
    if (!template) {
      res
        .status(404)
        .json(ApiResponse.error('Template not found', ApiErrorCode.NOT_FOUND));
      return;
    }
    const sample = (req.body?.sample ?? {}) as Record<string, string>;
    const { renderTemplate } = await import('../domain/mergeFields');
    res.json(
      ApiResponse.success({
        subject: renderTemplate(template.subject, sample),
        bodyText: renderTemplate(template.bodyText, sample),
        bodyHtml: renderTemplate(template.bodyHtml, sample),
        version: template.version,
      })
    );
  };

  testSendTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
    const template = await this.store.getTemplateById(String(req.params.id));
    const to = String(req.user?.email || '').trim();
    if (!template) {
      res
        .status(404)
        .json(ApiResponse.error('Template not found', ApiErrorCode.NOT_FOUND));
      return;
    }
    if (!to) {
      res
        .status(400)
        .json(ApiResponse.error('Admin email missing', ApiErrorCode.VALIDATION_ERROR));
      return;
    }
    const sample = (req.body?.sample ?? {
      client_first_name: 'Test',
      contact_email: 'hello@sokanacollective.com',
    }) as Record<string, string>;
    const { renderTemplate, htmlFromText } = await import('../domain/mergeFields');
    const subject = renderTemplate(template.subject, sample);
    const text = renderTemplate(template.bodyText, sample);
    const html = template.bodyHtml
      ? renderTemplate(template.bodyHtml, sample)
      : htmlFromText(text);
    await this.email.sendEmail(to, subject, text, html);
    await this.store.insertSendLog({
      runId: null,
      policyKey: 'test_send',
      stepOrder: null,
      templateKey: template.key,
      templateVersion: template.version,
      idempotencyKey: `test:${template.id}:${Date.now()}:${to}`,
      recipientRole: 'admin',
      recipientEmail: to,
      channel: 'email',
      status: 'test',
    });
    res.json(ApiResponse.success({ sentTo: to, templateKey: template.key }));
  };

  listRuns = async (req: AuthRequest, res: Response): Promise<void> => {
    const status = req.query.status ? String(req.query.status) : undefined;
    const runs = await this.store.listRuns({
      status: status as never,
      policyKey: req.query.policyKey ? String(req.query.policyKey) : undefined,
      clientId: req.query.clientId ? String(req.query.clientId) : undefined,
      contractId: req.query.contractId ? String(req.query.contractId) : undefined,
    });
    res.json(ApiResponse.list(runs, runs.length));
  };

  listSendLog = async (req: AuthRequest, res: Response): Promise<void> => {
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const offset = Math.max(Number(req.query.offset ?? 0), 0);
    const result = await this.store.listSendLog({
      limit,
      offset,
      policyKey: req.query.policyKey ? String(req.query.policyKey) : undefined,
      status: req.query.status ? (String(req.query.status) as never) : undefined,
    });
    res.json(ApiResponse.list(result.rows, result.total, { limit, offset }));
  };

  getSettings = async (_req: AuthRequest, res: Response): Promise<void> => {
    const settings = await this.store.getSettings();
    const notes = await this.store.getPolicyByKey('overdue_notes');
    res.json(
      ApiResponse.success({
        ...settings,
        overdue_days: Number(notes?.config.overdue_days ?? 7),
        test_tools_enabled:
          (process.env.REMINDER_TEST_TOOLS_ENABLED || '').toLowerCase() ===
            'true' ||
          process.env.REMINDER_TEST_TOOLS_ENABLED === '1',
      })
    );
  };

  patchSettings = async (req: AuthRequest, res: Response): Promise<void> => {
    const body = z
      .object({
        remindersEnabled: z.boolean().optional(),
        testRecipientOverrideEmail: z.string().email().nullable().optional(),
        contactEmail: z.string().email().optional(),
        adminNotificationEmail: z.string().email().optional(),
        billingNotificationEmail: z.string().email().optional(),
        evaluationLink: z.string().url().nullable().optional(),
      })
      .parse(req.body);
    const settings = await this.store.updateSettings(body);
    const notes = await this.store.getPolicyByKey('overdue_notes');
    res.json(
      ApiResponse.success({
        ...settings,
        overdue_days: Number(notes?.config.overdue_days ?? 7),
      })
    );
  };

  listAlerts = async (req: AuthRequest, res: Response): Promise<void> => {
    const unacked = String(req.query.unacknowledged || '') === 'true';
    const alerts = await this.store.listAlerts(unacked);
    res.json(ApiResponse.list(alerts, alerts.length));
  };

  ackAlert = async (req: AuthRequest, res: Response): Promise<void> => {
    const alert = await this.store.acknowledgeAlert(
      String(req.params.id),
      String(req.user?.id || '')
    );
    if (!alert) {
      res.status(404).json(ApiResponse.error('Alert not found', ApiErrorCode.NOT_FOUND));
      return;
    }
    res.json(ApiResponse.success(alert));
  };

  stopContractReminders = async (req: AuthRequest, res: Response): Promise<void> => {
    uuidSchema.parse(req.params.id);
    await this.engine.stopContractReminders(
      String(req.params.id),
      String(req.user?.id || ''),
      req.body?.reason ? String(req.body.reason) : undefined
    );
    res.json(ApiResponse.success({ stopped: true }));
  };

  resumeContractReminders = async (req: AuthRequest, res: Response): Promise<void> => {
    uuidSchema.parse(req.params.id);
    await this.engine.resumeContractReminders(
      String(req.params.id),
      String(req.user?.id || '')
    );
    res.json(ApiResponse.success({ resumed: true }));
  };

  listPostponements = async (req: AuthRequest, res: Response): Promise<void> => {
    const rows = await this.postponements.list(String(req.params.id));
    res.json(ApiResponse.list(rows, rows.length));
  };

  createPostponement = async (req: AuthRequest, res: Response): Promise<void> => {
    const body = z
      .object({
        contractId: z.string().uuid().nullable().optional(),
        reasonCode: z.enum(POSTPONEMENT_REASON_CODES),
        reasonNote: z.string().nullable().optional(),
        restartAt: z.string().datetime().optional(),
      })
      .parse(req.body);
    const result = await this.postponements.create({
      clientId: String(req.params.id),
      contractId: body.contractId,
      reasonCode: body.reasonCode,
      reasonNote: body.reasonNote,
      restartAt: body.restartAt ? new Date(body.restartAt) : undefined,
      actorId: String(req.user?.id || ''),
      asAdmin: true,
    });
    res.status(201).json(ApiResponse.success(result));
  };

  requestPostponement = async (req: AuthRequest, res: Response): Promise<void> => {
    const body = z
      .object({
        contractId: z.string().uuid().nullable().optional(),
        reasonCode: z.enum(POSTPONEMENT_REASON_CODES),
        reasonNote: z.string().nullable().optional(),
        restartAt: z.string().datetime().optional(),
      })
      .parse(req.body);
    const result = await this.postponements.create({
      clientId: String(req.params.id),
      contractId: body.contractId,
      reasonCode: body.reasonCode,
      reasonNote: body.reasonNote,
      restartAt: body.restartAt ? new Date(body.restartAt) : undefined,
      actorId: String(req.user?.id || ''),
      asAdmin: false,
    });
    res.status(201).json(ApiResponse.success(result));
  };

  approvePostponement = async (req: AuthRequest, res: Response): Promise<void> => {
    const row = await this.postponements.approve(
      String(req.params.id),
      String(req.user?.id || '')
    );
    res.json(ApiResponse.success(row));
  };

  liftPostponement = async (req: AuthRequest, res: Response): Promise<void> => {
    const row = await this.postponements.lift(
      String(req.params.id),
      String(req.user?.id || '')
    );
    res.json(ApiResponse.success(row));
  };

  extendPostponement = async (req: AuthRequest, res: Response): Promise<void> => {
    const body = z.object({ restartAt: z.string().datetime() }).parse(req.body);
    const result = await this.postponements.extend(
      String(req.params.id),
      String(req.user?.id || ''),
      new Date(body.restartAt)
    );
    res.json(ApiResponse.success(result));
  };

  cancelPostponement = async (req: AuthRequest, res: Response): Promise<void> => {
    const row = await this.postponements.cancel(
      String(req.params.id),
      String(req.user?.id || '')
    );
    res.json(ApiResponse.success(row));
  };

  tick = async (_req: AuthRequest, res: Response): Promise<void> => {
    const counts = await this.engine.tick();
    res.json(counts);
  };

  tickNow = async (_req: AuthRequest, res: Response): Promise<void> => {
    const counts = await this.engine.tick();
    res.json(ApiResponse.success(counts));
  };

  advanceRun = async (req: AuthRequest, res: Response): Promise<void> => {
    const run = await this.engine.advanceRun(String(req.params.id));
    res.json(ApiResponse.success(run));
  };
}
