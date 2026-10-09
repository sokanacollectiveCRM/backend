import { randomUUID } from 'crypto';

import { getPool, queryCloudSql } from '../../../db/cloudSqlPool';
import {
  isClientDepositRequired,
  resolveBillingPath,
} from '../../portal/domain/eligibility';
import {
  InsertSendLogInput,
  MessagingStore,
  UniqueViolationError,
} from '../application/store';
import {
  AdminAlert,
  ClientFacts,
  ClientPostponement,
  ContractFacts,
  ContractReminderOverride,
  DelayUnit,
  EndAction,
  MessageChannel,
  MessageTemplate,
  MessagingSettings,
  PostponementEvent,
  PostponementReasonCode,
  PostponementStatus,
  RecipientRole,
  ReminderPolicy,
  ReminderPolicyStep,
  ReminderRun,
  ReminderSendLog,
  RunStatus,
  SendStatus,
} from '../domain/types';

function asDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function requiredDate(value: Date | string): Date {
  return asDate(value) ?? new Date();
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

function mapTemplate(row: Record<string, unknown>): MessageTemplate {
  return {
    id: String(row.id),
    key: String(row.key),
    name: String(row.name),
    channel: row.channel as MessageChannel,
    subject: String(row.subject ?? ''),
    bodyText: String(row.body_text ?? ''),
    bodyHtml: String(row.body_html ?? ''),
    version: Number(row.version ?? 1),
    updatedBy: row.updated_by ? String(row.updated_by) : null,
    updatedAt: requiredDate(row.updated_at as Date | string),
  };
}

function mapStep(row: Record<string, unknown>): ReminderPolicyStep {
  return {
    id: String(row.id),
    policyId: String(row.policy_id),
    stepOrder: Number(row.step_order),
    delayValue: Number(row.delay_value),
    delayUnit: row.delay_unit as DelayUnit,
    repeatEveryValue:
      row.repeat_every_value == null ? null : Number(row.repeat_every_value),
    repeatEveryUnit: (row.repeat_every_unit as DelayUnit) ?? null,
    channel: row.channel as MessageChannel,
    recipientRoles: (row.recipient_roles as RecipientRole[]) ?? [],
    templateId: String(row.template_id),
    templateKey: row.template_key ? String(row.template_key) : undefined,
    enabled: Boolean(row.enabled),
  };
}

function mapPolicy(
  row: Record<string, unknown>,
  steps: ReminderPolicyStep[]
): ReminderPolicy {
  return {
    id: String(row.id),
    key: String(row.key),
    name: String(row.name),
    description: String(row.description ?? ''),
    enabled: Boolean(row.enabled),
    triggerEvent: String(row.trigger_event),
    anchorField: String(row.anchor_field),
    stopConditions: parseJson<string[]>(row.stop_conditions, []),
    endAction: row.end_action as EndAction,
    endActionDelayValue:
      row.end_action_delay_value == null
        ? null
        : Number(row.end_action_delay_value),
    endActionDelayUnit: (row.end_action_delay_unit as DelayUnit) ?? null,
    endActionTemplateKeys: (row.end_action_template_keys as string[]) ?? [],
    notifyAdminEmail: Boolean(row.notify_admin_email),
    alertAdminAfterSends:
      row.alert_admin_after_sends == null
        ? null
        : Number(row.alert_admin_after_sends),
    config: parseJson<Record<string, unknown>>(row.config, {}),
    updatedBy: row.updated_by ? String(row.updated_by) : null,
    updatedAt: requiredDate(row.updated_at as Date | string),
    steps,
  };
}

function mapRun(row: Record<string, unknown>): ReminderRun {
  return {
    id: String(row.id),
    policyId: String(row.policy_id),
    policyKey: String(row.policy_key ?? ''),
    subjectType: String(row.subject_type),
    subjectId: String(row.subject_id),
    clientId: row.client_id ? String(row.client_id) : null,
    contractId: row.contract_id ? String(row.contract_id) : null,
    doulaId: row.doula_id ? String(row.doula_id) : null,
    status: row.status as RunStatus,
    anchorAt: requiredDate(row.anchor_at as Date | string),
    currentStep: Number(row.current_step ?? 0),
    nextDueAt: asDate(row.next_due_at as Date | string | null),
    endActionDueAt: asDate(row.end_action_due_at as Date | string | null),
    sendsCount: Number(row.sends_count ?? 0),
    pauseReason: row.pause_reason ? String(row.pause_reason) : null,
    completedReason: row.completed_reason ? String(row.completed_reason) : null,
    claimedUntil: asDate(row.claimed_until as Date | string | null),
  };
}

const RUN_SELECT = `
  SELECT r.*, p.key AS policy_key
  FROM public.reminder_runs r
  JOIN public.reminder_policies p ON p.id = r.policy_id
`;

const PAID_STATUSES = ['paid', 'succeeded', 'completed'];

export class PostgresMessagingStore implements MessagingStore {
  async getSettings(): Promise<MessagingSettings> {
    const { rows } = await queryCloudSql<Record<string, unknown>>(
      `SELECT * FROM public.messaging_settings WHERE id = 1`
    );
    const row = rows[0] ?? {};
    return {
      remindersEnabled:
        row.reminders_enabled == null
          ? (process.env.REMINDERS_ENABLED ?? 'true').toLowerCase() !== 'false'
          : Boolean(row.reminders_enabled),
      testRecipientOverrideEmail: row.test_recipient_override_email
        ? String(row.test_recipient_override_email)
        : null,
      contactEmail: String(row.contact_email ?? 'hello@sokanacollective.com'),
      adminNotificationEmail: String(
        row.admin_notification_email ??
          process.env.ADMIN_NOTIFICATION_EMAIL ??
          'hello@sokanacollective.com'
      ),
      billingNotificationEmail: String(
        row.billing_notification_email ??
          process.env.BILLING_NOTIFICATION_EMAIL ??
          'billing@sokanacollective.com'
      ),
      evaluationLink: row.evaluation_link ? String(row.evaluation_link) : null,
    };
  }

  async updateSettings(
    patch: Partial<MessagingSettings>
  ): Promise<MessagingSettings> {
    await queryCloudSql(
      `UPDATE public.messaging_settings
       SET reminders_enabled = COALESCE($1, reminders_enabled),
           test_recipient_override_email = COALESCE($2, test_recipient_override_email),
           contact_email = COALESCE($3, contact_email),
           admin_notification_email = COALESCE($4, admin_notification_email),
           billing_notification_email = COALESCE($5, billing_notification_email),
           evaluation_link = COALESCE($6, evaluation_link),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = 1`,
      [
        patch.remindersEnabled ?? null,
        patch.testRecipientOverrideEmail === undefined
          ? null
          : patch.testRecipientOverrideEmail,
        patch.contactEmail ?? null,
        patch.adminNotificationEmail ?? null,
        patch.billingNotificationEmail ?? null,
        patch.evaluationLink === undefined ? null : patch.evaluationLink,
      ]
    );
    if (patch.testRecipientOverrideEmail === null) {
      await queryCloudSql(
        `UPDATE public.messaging_settings SET test_recipient_override_email = NULL WHERE id = 1`
      );
    }
    return this.getSettings();
  }

  async listPolicies(): Promise<ReminderPolicy[]> {
    const { rows } = await queryCloudSql<Record<string, unknown>>(
      `SELECT * FROM public.reminder_policies ORDER BY name`
    );
    const steps = await this.loadSteps();
    return rows.map((row) =>
      mapPolicy(
        row,
        steps.filter((s) => s.policyId === String(row.id))
      )
    );
  }

  async getPolicyById(id: string): Promise<ReminderPolicy | null> {
    const { rows } = await queryCloudSql<Record<string, unknown>>(
      `SELECT * FROM public.reminder_policies WHERE id = $1::uuid`,
      [id]
    );
    if (!rows[0]) return null;
    const steps = await this.loadSteps(id);
    return mapPolicy(rows[0], steps);
  }

  async getPolicyByKey(key: string): Promise<ReminderPolicy | null> {
    const { rows } = await queryCloudSql<Record<string, unknown>>(
      `SELECT * FROM public.reminder_policies WHERE key = $1`,
      [key]
    );
    if (!rows[0]) return null;
    const steps = await this.loadSteps(String(rows[0].id));
    return mapPolicy(rows[0], steps);
  }

  async updatePolicy(
    id: string,
    patch: Record<string, unknown>
  ): Promise<ReminderPolicy> {
    await queryCloudSql(
      `UPDATE public.reminder_policies
       SET name = COALESCE($2, name),
           description = COALESCE($3, description),
           enabled = COALESCE($4::boolean, enabled),
           stop_conditions = COALESCE($5::jsonb, stop_conditions),
           end_action = COALESCE($6, end_action),
           end_action_delay_value = COALESCE($7, end_action_delay_value),
           end_action_delay_unit = COALESCE($8, end_action_delay_unit),
           end_action_template_keys = COALESCE($9::text[], end_action_template_keys),
           notify_admin_email = COALESCE($10, notify_admin_email),
           alert_admin_after_sends = COALESCE($11, alert_admin_after_sends),
           config = COALESCE($12::jsonb, config),
           updated_by = COALESCE($13::uuid, updated_by),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1::uuid`,
      [
        id,
        patch.name ?? null,
        patch.description ?? null,
        patch.enabled === undefined ? null : patch.enabled,
        patch.stopConditions ? JSON.stringify(patch.stopConditions) : null,
        patch.endAction ?? null,
        patch.endActionDelayValue ?? null,
        patch.endActionDelayUnit ?? null,
        patch.endActionTemplateKeys ?? null,
        patch.notifyAdminEmail ?? null,
        patch.alertAdminAfterSends ?? null,
        patch.config ? JSON.stringify(patch.config) : null,
        patch.updatedBy ?? null,
      ]
    );
    const updated = await this.getPolicyById(id);
    if (!updated) throw new Error('Policy not found');
    return updated;
  }

  async replaceSteps(
    policyId: string,
    steps: Omit<ReminderPolicyStep, 'id' | 'policyId'>[]
  ): Promise<ReminderPolicyStep[]> {
    await queryCloudSql(
      `DELETE FROM public.reminder_policy_steps WHERE policy_id = $1::uuid`,
      [policyId]
    );
    for (const step of steps) {
      await queryCloudSql(
        `INSERT INTO public.reminder_policy_steps
         (policy_id, step_order, delay_value, delay_unit, repeat_every_value,
          repeat_every_unit, channel, recipient_roles, template_id, enabled)
         VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8::text[], $9::uuid, $10)`,
        [
          policyId,
          step.stepOrder,
          step.delayValue,
          step.delayUnit,
          step.repeatEveryValue,
          step.repeatEveryUnit,
          step.channel,
          step.recipientRoles,
          step.templateId,
          step.enabled,
        ]
      );
    }
    return this.loadSteps(policyId);
  }

  async listTemplates(): Promise<MessageTemplate[]> {
    const { rows } = await queryCloudSql<Record<string, unknown>>(
      `SELECT * FROM public.message_templates ORDER BY name`
    );
    return rows.map(mapTemplate);
  }

  async getTemplateById(id: string): Promise<MessageTemplate | null> {
    const { rows } = await queryCloudSql<Record<string, unknown>>(
      `SELECT * FROM public.message_templates WHERE id = $1::uuid`,
      [id]
    );
    return rows[0] ? mapTemplate(rows[0]) : null;
  }

  async getTemplateByKey(key: string): Promise<MessageTemplate | null> {
    const { rows } = await queryCloudSql<Record<string, unknown>>(
      `SELECT * FROM public.message_templates WHERE key = $1`,
      [key]
    );
    return rows[0] ? mapTemplate(rows[0]) : null;
  }

  async updateTemplate(
    id: string,
    patch: Partial<{
      name: string;
      channel: MessageChannel;
      subject: string;
      bodyText: string;
      bodyHtml: string;
      updatedBy: string | null;
    }>
  ): Promise<MessageTemplate> {
    await queryCloudSql(
      `UPDATE public.message_templates
       SET name = COALESCE($2, name),
           channel = COALESCE($3, channel),
           subject = COALESCE($4, subject),
           body_text = COALESCE($5, body_text),
           body_html = COALESCE($6, body_html),
           version = version + 1,
           updated_by = COALESCE($7::uuid, updated_by),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1::uuid`,
      [
        id,
        patch.name ?? null,
        patch.channel ?? null,
        patch.subject ?? null,
        patch.bodyText ?? null,
        patch.bodyHtml ?? null,
        patch.updatedBy ?? null,
      ]
    );
    const updated = await this.getTemplateById(id);
    if (!updated) throw new Error('Template not found');
    return updated;
  }

  async createRun(
    input: Omit<ReminderRun, 'id' | 'claimedUntil'> & { id?: string }
  ): Promise<ReminderRun> {
    const existing = await this.findOpenRun(
      input.policyId,
      input.subjectType,
      input.subjectId
    );
    if (existing) return existing;
    const id = input.id ?? randomUUID();
    try {
      const { rows } = await queryCloudSql<Record<string, unknown>>(
        `INSERT INTO public.reminder_runs
         (id, policy_id, subject_type, subject_id, client_id, contract_id, doula_id,
          status, anchor_at, current_step, next_due_at, end_action_due_at, sends_count,
          pause_reason, completed_reason)
         VALUES ($1::uuid, $2::uuid, $3, $4::uuid, $5::uuid, $6::uuid, $7::uuid,
                 $8, $9, $10, $11, $12, $13, $14, $15)
         RETURNING *`,
        [
          id,
          input.policyId,
          input.subjectType,
          input.subjectId,
          input.clientId,
          input.contractId,
          input.doulaId,
          input.status,
          input.anchorAt,
          input.currentStep,
          input.nextDueAt,
          input.endActionDueAt,
          input.sendsCount,
          input.pauseReason,
          input.completedReason,
        ]
      );
      return { ...mapRun(rows[0]), policyKey: input.policyKey };
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        const again = await this.findOpenRun(
          input.policyId,
          input.subjectType,
          input.subjectId
        );
        if (again) return again;
      }
      throw error;
    }
  }

  async getRunById(id: string): Promise<ReminderRun | null> {
    const { rows } = await queryCloudSql<Record<string, unknown>>(
      `${RUN_SELECT} WHERE r.id = $1::uuid`,
      [id]
    );
    return rows[0] ? mapRun(rows[0]) : null;
  }

  async findOpenRun(
    policyId: string,
    subjectType: string,
    subjectId: string
  ): Promise<ReminderRun | null> {
    const { rows } = await queryCloudSql<Record<string, unknown>>(
      `${RUN_SELECT}
       WHERE r.policy_id = $1::uuid AND r.subject_type = $2 AND r.subject_id = $3::uuid
         AND r.status IN ('active', 'paused')
       LIMIT 1`,
      [policyId, subjectType, subjectId]
    );
    return rows[0] ? mapRun(rows[0]) : null;
  }

  async listRuns(filters: {
    status?: RunStatus | RunStatus[];
    policyKey?: string;
    clientId?: string;
    contractId?: string;
  }): Promise<ReminderRun[]> {
    const statuses = filters.status
      ? Array.isArray(filters.status)
        ? filters.status
        : [filters.status]
      : null;
    const { rows } = await queryCloudSql<Record<string, unknown>>(
      `${RUN_SELECT}
       WHERE ($1::text[] IS NULL OR r.status = ANY($1))
         AND ($2::text IS NULL OR p.key = $2)
         AND ($3::uuid IS NULL OR r.client_id = $3::uuid)
         AND ($4::uuid IS NULL OR r.contract_id = $4::uuid)
       ORDER BY r.next_due_at NULLS LAST, r.created_at`,
      [
        statuses,
        filters.policyKey ?? null,
        filters.clientId ?? null,
        filters.contractId ?? null,
      ]
    );
    return rows.map(mapRun);
  }

  async updateRun(
    id: string,
    patch: Partial<ReminderRun>
  ): Promise<ReminderRun> {
    await queryCloudSql(
      `UPDATE public.reminder_runs
       SET status = COALESCE($2, status),
           anchor_at = COALESCE($3, anchor_at),
           current_step = COALESCE($4, current_step),
           next_due_at = CASE WHEN $5::boolean THEN $6 ELSE next_due_at END,
           end_action_due_at = CASE WHEN $7::boolean THEN $8 ELSE end_action_due_at END,
           sends_count = COALESCE($9, sends_count),
           pause_reason = CASE WHEN $10::boolean THEN $11 ELSE pause_reason END,
           completed_reason = CASE WHEN $12::boolean THEN $13 ELSE completed_reason END,
           claimed_until = CASE WHEN $14::boolean THEN $15 ELSE claimed_until END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1::uuid`,
      [
        id,
        patch.status ?? null,
        patch.anchorAt ?? null,
        patch.currentStep ?? null,
        patch.nextDueAt !== undefined,
        patch.nextDueAt ?? null,
        patch.endActionDueAt !== undefined,
        patch.endActionDueAt ?? null,
        patch.sendsCount ?? null,
        patch.pauseReason !== undefined,
        patch.pauseReason ?? null,
        patch.completedReason !== undefined,
        patch.completedReason ?? null,
        patch.claimedUntil !== undefined,
        patch.claimedUntil ?? null,
      ]
    );
    const run = await this.getRunById(id);
    if (!run) throw new Error('Run not found');
    return run;
  }

  async claimDueRuns(now: Date, limit: number): Promise<ReminderRun[]> {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query<Record<string, unknown>>(
        `${RUN_SELECT}
         WHERE r.status = 'active'
           AND (r.next_due_at <= $1 OR r.end_action_due_at <= $1)
           AND (r.claimed_until IS NULL OR r.claimed_until < $1)
         ORDER BY r.next_due_at NULLS LAST
         LIMIT $2
         FOR UPDATE OF r SKIP LOCKED`,
        [now, limit]
      );
      const ids = rows.map((row) => String(row.id));
      if (ids.length) {
        await client.query(
          `UPDATE public.reminder_runs
           SET claimed_until = $2, updated_at = CURRENT_TIMESTAMP
           WHERE id = ANY($1::uuid[])`,
          [ids, new Date(now.getTime() + 2 * 60 * 1000)]
        );
      }
      await client.query('COMMIT');
      return rows.map(mapRun);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async pauseRunsForSubject(input: {
    clientId?: string | null;
    contractId?: string | null;
    reason: string;
  }): Promise<ReminderRun[]> {
    const { rows } = await queryCloudSql<Record<string, unknown>>(
      `UPDATE public.reminder_runs r
       SET status = 'paused', pause_reason = $3, updated_at = CURRENT_TIMESTAMP
       FROM public.reminder_policies p
       WHERE p.id = r.policy_id
         AND r.status = 'active'
         AND (
           ($1::uuid IS NOT NULL AND r.client_id = $1::uuid)
           OR ($2::uuid IS NOT NULL AND r.contract_id = $2::uuid)
         )
       RETURNING r.*, p.key AS policy_key`,
      [input.clientId ?? null, input.contractId ?? null, input.reason]
    );
    return rows.map(mapRun);
  }

  async insertSendLog(input: InsertSendLogInput): Promise<ReminderSendLog> {
    try {
      const { rows } = await queryCloudSql<Record<string, unknown>>(
        `INSERT INTO public.reminder_send_log
         (run_id, policy_key, step_order, template_key, template_version,
          idempotency_key, recipient_role, recipient_email, channel, status,
          suppress_reason, error_class)
         VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [
          input.runId,
          input.policyKey,
          input.stepOrder,
          input.templateKey,
          input.templateVersion,
          input.idempotencyKey,
          input.recipientRole,
          input.recipientEmail,
          input.channel,
          input.status,
          input.suppressReason ?? null,
          input.errorClass ?? null,
        ]
      );
      return this.mapSendLog(rows[0]);
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new UniqueViolationError();
      }
      throw error;
    }
  }

  async findSendLogByKey(
    idempotencyKey: string
  ): Promise<ReminderSendLog | null> {
    const { rows } = await queryCloudSql<Record<string, unknown>>(
      `SELECT * FROM public.reminder_send_log WHERE idempotency_key = $1`,
      [idempotencyKey]
    );
    return rows[0] ? this.mapSendLog(rows[0]) : null;
  }

  async listSendLog(input: {
    limit: number;
    offset: number;
    policyKey?: string;
    status?: SendStatus;
  }): Promise<{ rows: ReminderSendLog[]; total: number }> {
    const { rows } = await queryCloudSql<Record<string, unknown>>(
      `SELECT *, COUNT(*) OVER() AS total_count
       FROM public.reminder_send_log
       WHERE ($1::text IS NULL OR policy_key = $1)
         AND ($2::text IS NULL OR status = $2)
       ORDER BY created_at DESC
       LIMIT $3 OFFSET $4`,
      [input.policyKey ?? null, input.status ?? null, input.limit, input.offset]
    );
    return {
      total: Number(rows[0]?.total_count ?? 0),
      rows: rows.map((row) => this.mapSendLog(row)),
    };
  }

  async countSendsForRunStep(
    runId: string,
    stepOrder: number
  ): Promise<number> {
    const { rows } = await queryCloudSql<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM public.reminder_send_log
       WHERE run_id = $1::uuid AND step_order = $2 AND status = 'sent'`,
      [runId, stepOrder]
    );
    return Number(rows[0]?.count ?? 0);
  }

  async createAlert(input: {
    type: string;
    clientId?: string | null;
    contractId?: string | null;
    runId?: string | null;
    message: string;
  }): Promise<AdminAlert> {
    const { rows } = await queryCloudSql<Record<string, unknown>>(
      `INSERT INTO public.admin_alerts (type, client_id, contract_id, run_id, message)
       VALUES ($1, $2::uuid, $3::uuid, $4::uuid, $5)
       RETURNING *`,
      [
        input.type,
        input.clientId ?? null,
        input.contractId ?? null,
        input.runId ?? null,
        input.message,
      ]
    );
    return this.mapAlert(rows[0]);
  }

  async listAlerts(unacknowledgedOnly?: boolean): Promise<AdminAlert[]> {
    const { rows } = await queryCloudSql<Record<string, unknown>>(
      `SELECT * FROM public.admin_alerts
       WHERE ($1::boolean IS NOT TRUE OR acknowledged_at IS NULL)
       ORDER BY created_at DESC
       LIMIT 200`,
      [unacknowledgedOnly ?? false]
    );
    return rows.map((row) => this.mapAlert(row));
  }

  async acknowledgeAlert(
    id: string,
    actorId: string
  ): Promise<AdminAlert | null> {
    const { rows } = await queryCloudSql<Record<string, unknown>>(
      `UPDATE public.admin_alerts
       SET acknowledged_by = $2::uuid, acknowledged_at = CURRENT_TIMESTAMP
       WHERE id = $1::uuid
       RETURNING *`,
      [id, actorId]
    );
    return rows[0] ? this.mapAlert(rows[0]) : null;
  }

  async getContractOverride(
    contractId: string
  ): Promise<ContractReminderOverride | null> {
    const { rows } = await queryCloudSql<Record<string, unknown>>(
      `SELECT * FROM public.contract_reminder_overrides WHERE contract_id = $1::uuid`,
      [contractId]
    );
    if (!rows[0]) return null;
    return {
      contractId: String(rows[0].contract_id),
      stopped: Boolean(rows[0].stopped),
      reason: rows[0].reason ? String(rows[0].reason) : null,
      updatedBy: rows[0].updated_by ? String(rows[0].updated_by) : null,
      updatedAt: requiredDate(rows[0].updated_at as Date | string),
    };
  }

  async upsertContractOverride(
    input: ContractReminderOverride
  ): Promise<ContractReminderOverride> {
    await queryCloudSql(
      `INSERT INTO public.contract_reminder_overrides
         (contract_id, stopped, reason, updated_by, updated_at)
       VALUES ($1::uuid, $2, $3, $4::uuid, $5)
       ON CONFLICT (contract_id) DO UPDATE
         SET stopped = EXCLUDED.stopped,
             reason = EXCLUDED.reason,
             updated_by = EXCLUDED.updated_by,
             updated_at = EXCLUDED.updated_at`,
      [
        input.contractId,
        input.stopped,
        input.reason,
        input.updatedBy,
        input.updatedAt,
      ]
    );
    return input;
  }

  async getContractFacts(contractId: string): Promise<ContractFacts | null> {
    const { rows } = await queryCloudSql<Record<string, unknown>>(
      `SELECT
         c.id, c.client_id, c.status, c.sent_at,
         cl.first_name, cl.last_name, cl.email, cl.payment_method,
         da.doula_id, d.full_name AS doula_name, d.email AS doula_email,
         COALESCE(o.stopped, false) AS reminders_stopped,
         EXISTS (
           SELECT 1
           FROM public.payment_installments pi
           JOIN public.payment_schedules ps ON ps.id = pi.schedule_id
           WHERE ps.contract_id = c.id
             AND COALESCE(pi.payment_type, '') = 'deposit'
             AND LOWER(COALESCE(pi.status, '')) = ANY($2::text[])
         ) AS deposit_paid,
         COALESCE((
           SELECT pi.amount FROM public.payment_installments pi
           JOIN public.payment_schedules ps ON ps.id = pi.schedule_id
           WHERE ps.contract_id = c.id AND COALESCE(pi.payment_type, '') = 'deposit'
           LIMIT 1
         ), 0) AS deposit_amount
       FROM public.phi_contracts c
       JOIN public.phi_clients cl ON cl.id = c.client_id
       LEFT JOIN LATERAL (
         SELECT doula_id FROM public.doula_assignments
         WHERE client_id = c.client_id AND status = 'active'
         ORDER BY assigned_at DESC NULLS LAST
         LIMIT 1
       ) da ON true
       LEFT JOIN public.doulas d ON d.id = da.doula_id
       LEFT JOIN public.contract_reminder_overrides o ON o.contract_id = c.id
       WHERE c.id = $1::uuid`,
      [contractId, PAID_STATUSES]
    );
    if (!rows[0]) return null;
    return this.mapContractFacts(rows[0]);
  }

  async getClientFacts(clientId: string): Promise<ClientFacts | null> {
    const { rows } = await queryCloudSql<Record<string, unknown>>(
      `${this.clientFactsSql()} WHERE cl.id = $1::uuid`,
      [clientId, PAID_STATUSES]
    );
    return rows[0] ? this.mapClientFacts(rows[0]) : null;
  }

  async listDueDateScanCandidates(
    now: Date,
    daysAfter: number
  ): Promise<ClientFacts[]> {
    const { rows } = await queryCloudSql<Record<string, unknown>>(
      `${this.clientFactsSql()}
       WHERE cl.due_date IS NOT NULL
         AND cl.due_date <= ($3::date - ($4 || ' days')::interval)
         AND cl.birth_outcomes_delivery_type IS NULL`,
      [null, PAID_STATUSES, now, String(daysAfter)]
    );
    return rows.map((row) => this.mapClientFacts(row));
  }

  async listOverdueNoteCandidates(
    now: Date,
    overdueDays: number
  ): Promise<ClientFacts[]> {
    const { rows } = await queryCloudSql<Record<string, unknown>>(
      `${this.clientFactsSql()}
       WHERE da.doula_id IS NOT NULL
         AND (
           last_note.last_note_at IS NULL
           OR last_note.last_note_at < ($3::timestamptz - ($4 || ' days')::interval)
         )`,
      [null, PAID_STATUSES, now, String(overdueDays)]
    );
    return rows.map((row) => this.mapClientFacts(row));
  }

  async listHoursLowCandidates(
    thresholdHours: number,
    remainingPct: number
  ): Promise<ClientFacts[]> {
    const { rows } = await queryCloudSql<Record<string, unknown>>(
      `${this.clientFactsSql()}
       WHERE hours_contracted.hours_contracted IS NOT NULL
         AND hours_contracted.hours_contracted > 0
         AND (
           (hours_contracted.hours_contracted - COALESCE(pp.postpartum_hours, 0)) <= $3
           OR (
             (hours_contracted.hours_contracted - COALESCE(pp.postpartum_hours, 0))
             / hours_contracted.hours_contracted * 100
           ) <= $4
         )`,
      [null, PAID_STATUSES, thresholdHours, remainingPct]
    );
    return rows.map((row) => this.mapClientFacts(row));
  }

  async listDepositPaidNoCardCandidates(): Promise<ClientFacts[]> {
    const { rows } = await queryCloudSql<Record<string, unknown>>(
      `${this.clientFactsSql()}
       WHERE COALESCE(ready.deposit_paid, false) = true
         AND COALESCE(ready.card_on_file, false) = false`,
      [null, PAID_STATUSES]
    );
    return rows.map((row) => this.mapClientFacts(row));
  }

  async listDoulaEmail(
    doulaId: string
  ): Promise<{ email: string | null; name: string } | null> {
    const { rows } = await queryCloudSql<{
      email: string | null;
      full_name: string | null;
    }>(`SELECT email, full_name FROM public.doulas WHERE id = $1::uuid`, [
      doulaId,
    ]);
    if (!rows[0]) return null;
    return { email: rows[0].email, name: rows[0].full_name || '' };
  }

  async createPostponement(input: {
    clientId: string;
    contractId?: string | null;
    reasonCode: PostponementReasonCode;
    reasonNote?: string | null;
    requestedBy?: string | null;
    approvedBy?: string | null;
    startsAt: Date;
    restartAt: Date;
    maxDays: number;
    status: PostponementStatus;
  }): Promise<ClientPostponement> {
    const { rows } = await queryCloudSql<Record<string, unknown>>(
      `INSERT INTO public.client_postponements
         (client_id, contract_id, reason_code, reason_note, requested_by, approved_by,
          starts_at, restart_at, max_days, status)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5::uuid, $6::uuid, $7, $8, $9, $10)
       RETURNING *`,
      [
        input.clientId,
        input.contractId ?? null,
        input.reasonCode,
        input.reasonNote ?? null,
        input.requestedBy ?? null,
        input.approvedBy ?? null,
        input.startsAt,
        input.restartAt,
        input.maxDays,
        input.status,
      ]
    );
    return this.mapPostponement(rows[0]);
  }

  async getPostponement(id: string): Promise<ClientPostponement | null> {
    const { rows } = await queryCloudSql<Record<string, unknown>>(
      `SELECT * FROM public.client_postponements WHERE id = $1::uuid`,
      [id]
    );
    return rows[0] ? this.mapPostponement(rows[0]) : null;
  }

  async listPostponements(clientId: string): Promise<ClientPostponement[]> {
    const { rows } = await queryCloudSql<Record<string, unknown>>(
      `SELECT * FROM public.client_postponements
       WHERE client_id = $1::uuid
       ORDER BY created_at DESC`,
      [clientId]
    );
    return rows.map((row) => this.mapPostponement(row));
  }

  async listActivePostponementsDue(now: Date): Promise<ClientPostponement[]> {
    const { rows } = await queryCloudSql<Record<string, unknown>>(
      `SELECT * FROM public.client_postponements
       WHERE status = 'active' AND restart_at <= $1`,
      [now]
    );
    return rows.map((row) => this.mapPostponement(row));
  }

  async findActivePostponement(input: {
    clientId?: string | null;
    contractId?: string | null;
  }): Promise<ClientPostponement | null> {
    const { rows } = await queryCloudSql<Record<string, unknown>>(
      `SELECT * FROM public.client_postponements
       WHERE status = 'active'
         AND (
           ($1::uuid IS NOT NULL AND client_id = $1::uuid)
           OR ($2::uuid IS NOT NULL AND contract_id = $2::uuid)
         )
       ORDER BY created_at DESC
       LIMIT 1`,
      [input.clientId ?? null, input.contractId ?? null]
    );
    return rows[0] ? this.mapPostponement(rows[0]) : null;
  }

  async updatePostponement(
    id: string,
    patch: Partial<ClientPostponement>
  ): Promise<ClientPostponement> {
    await queryCloudSql(
      `UPDATE public.client_postponements
       SET status = COALESCE($2, status),
           approved_by = COALESCE($3::uuid, approved_by),
           restart_at = COALESCE($4, restart_at),
           reason_note = COALESCE($5, reason_note),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1::uuid`,
      [
        id,
        patch.status ?? null,
        patch.approvedBy ?? null,
        patch.restartAt ?? null,
        patch.reasonNote ?? null,
      ]
    );
    const row = await this.getPostponement(id);
    if (!row) throw new Error('Postponement not found');
    return row;
  }

  async appendPostponementEvent(input: {
    postponementId: string;
    eventType: string;
    actorId?: string | null;
    payload?: Record<string, unknown>;
  }): Promise<PostponementEvent> {
    const { rows } = await queryCloudSql<Record<string, unknown>>(
      `INSERT INTO public.client_postponement_events
         (postponement_id, event_type, actor_id, payload)
       VALUES ($1::uuid, $2, $3::uuid, $4::jsonb)
       RETURNING *`,
      [
        input.postponementId,
        input.eventType,
        input.actorId ?? null,
        JSON.stringify(input.payload ?? {}),
      ]
    );
    return {
      id: String(rows[0].id),
      postponementId: String(rows[0].postponement_id),
      eventType: String(rows[0].event_type),
      actorId: rows[0].actor_id ? String(rows[0].actor_id) : null,
      payload: parseJson(rows[0].payload, {}),
      createdAt: requiredDate(rows[0].created_at as Date | string),
    };
  }

  async listPostponementEvents(
    postponementId: string
  ): Promise<PostponementEvent[]> {
    const { rows } = await queryCloudSql<Record<string, unknown>>(
      `SELECT * FROM public.client_postponement_events
       WHERE postponement_id = $1::uuid
       ORDER BY created_at ASC`,
      [postponementId]
    );
    return rows.map((row) => ({
      id: String(row.id),
      postponementId: String(row.postponement_id),
      eventType: String(row.event_type),
      actorId: row.actor_id ? String(row.actor_id) : null,
      payload: parseJson(row.payload, {}),
      createdAt: requiredDate(row.created_at as Date | string),
    }));
  }

  private async loadSteps(policyId?: string): Promise<ReminderPolicyStep[]> {
    const { rows } = await queryCloudSql<Record<string, unknown>>(
      `SELECT s.*, t.key AS template_key
       FROM public.reminder_policy_steps s
       JOIN public.message_templates t ON t.id = s.template_id
       WHERE ($1::uuid IS NULL OR s.policy_id = $1::uuid)
       ORDER BY s.step_order`,
      [policyId ?? null]
    );
    return rows.map(mapStep);
  }

  private clientFactsSql(): string {
    return `
      SELECT
        cl.id, cl.first_name, cl.last_name, cl.email, cl.status, cl.due_date,
        cl.birth_outcomes_delivery_type, cl.payment_method,
        da.doula_id, d.full_name AS doula_name, d.email AS doula_email,
        last_note.last_note_at,
        COALESCE(pp.postpartum_hours, 0) AS postpartum_hours,
        hours_contracted.hours_contracted,
        COALESCE(ready.deposit_paid, false) AS deposit_paid,
        COALESCE(ready.card_on_file, false) AS card_on_file
      FROM public.phi_clients cl
      LEFT JOIN LATERAL (
        SELECT doula_id FROM public.doula_assignments
        WHERE client_id = cl.id AND status = 'active'
        ORDER BY assigned_at DESC NULLS LAST
        LIMIT 1
      ) da ON true
      LEFT JOIN public.doulas d ON d.id = da.doula_id
      LEFT JOIN LATERAL (
        SELECT MAX(timestamp) AS last_note_at
        FROM public.client_activities
        WHERE client_id = cl.id
      ) last_note ON true
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (end_time - start_time)) / 3600.0), 0) AS postpartum_hours
        FROM public.hours
        WHERE client_id = cl.id AND LOWER(COALESCE(type, '')) = 'postpartum'
      ) pp ON true
      LEFT JOIN LATERAL (
        SELECT COALESCE(
          NULLIF(to_jsonb(c)->>'total_hours', ''),
          NULLIF(to_jsonb(c)#>>'{contract_data,total_hours}', ''),
          NULLIF(c.field_snapshot#>>'{pricing,totalHours}', '')
        )::numeric AS hours_contracted
        FROM public.phi_contracts c
        WHERE c.client_id = cl.id
        ORDER BY c.updated_at DESC
        LIMIT 1
      ) hours_contracted ON true
      LEFT JOIN public.client_onboarding_readiness ready ON ready.client_id = cl.id
    `;
  }

  private mapContractFacts(row: Record<string, unknown>): ContractFacts {
    const billingPath = resolveBillingPath(
      row.payment_method ? String(row.payment_method) : null
    );
    const depositAmount = Number(row.deposit_amount ?? 0);
    const depositRequired =
      isClientDepositRequired(billingPath) && depositAmount > 0;
    return {
      id: String(row.id),
      clientId: String(row.client_id),
      status: String(row.status),
      sentAt: asDate(row.sent_at as Date | string | null),
      clientFirstName: String(row.first_name ?? ''),
      clientLastName: String(row.last_name ?? ''),
      clientEmail: row.email ? String(row.email) : null,
      doulaId: row.doula_id ? String(row.doula_id) : null,
      doulaName: row.doula_name ? String(row.doula_name) : null,
      doulaEmail: row.doula_email ? String(row.doula_email) : null,
      depositRequired,
      depositPaid: Boolean(row.deposit_paid),
      remindersStopped: Boolean(row.reminders_stopped),
    };
  }

  private mapClientFacts(row: Record<string, unknown>): ClientFacts {
    return {
      id: String(row.id),
      firstName: String(row.first_name ?? ''),
      lastName: String(row.last_name ?? ''),
      email: row.email ? String(row.email) : null,
      status: String(row.status ?? ''),
      dueDate: asDate(row.due_date as Date | string | null),
      birthOutcomesRecorded: Boolean(row.birth_outcomes_delivery_type),
      doulaId: row.doula_id ? String(row.doula_id) : null,
      doulaName: row.doula_name ? String(row.doula_name) : null,
      doulaEmail: row.doula_email ? String(row.doula_email) : null,
      lastNoteAt: asDate(row.last_note_at as Date | string | null),
      postpartumHoursLogged: Number(row.postpartum_hours ?? 0),
      hoursContracted:
        row.hours_contracted == null ? null : Number(row.hours_contracted),
      depositPaid: Boolean(row.deposit_paid),
      cardOnFile: Boolean(row.card_on_file),
    };
  }

  private mapSendLog(row: Record<string, unknown>): ReminderSendLog {
    return {
      id: String(row.id),
      runId: row.run_id ? String(row.run_id) : null,
      policyKey: String(row.policy_key),
      stepOrder: row.step_order == null ? null : Number(row.step_order),
      templateKey: row.template_key ? String(row.template_key) : null,
      templateVersion:
        row.template_version == null ? null : Number(row.template_version),
      idempotencyKey: String(row.idempotency_key),
      recipientRole: (row.recipient_role as RecipientRole) ?? null,
      recipientEmail: row.recipient_email ? String(row.recipient_email) : null,
      channel: row.channel as MessageChannel,
      status: row.status as SendStatus,
      suppressReason: row.suppress_reason ? String(row.suppress_reason) : null,
      errorClass: row.error_class ? String(row.error_class) : null,
      createdAt: requiredDate(row.created_at as Date | string),
    };
  }

  private mapAlert(row: Record<string, unknown>): AdminAlert {
    return {
      id: String(row.id),
      type: String(row.type),
      clientId: row.client_id ? String(row.client_id) : null,
      contractId: row.contract_id ? String(row.contract_id) : null,
      runId: row.run_id ? String(row.run_id) : null,
      message: String(row.message),
      createdAt: requiredDate(row.created_at as Date | string),
      acknowledgedBy: row.acknowledged_by ? String(row.acknowledged_by) : null,
      acknowledgedAt: asDate(row.acknowledged_at as Date | string | null),
    };
  }

  private mapPostponement(row: Record<string, unknown>): ClientPostponement {
    return {
      id: String(row.id),
      clientId: String(row.client_id),
      contractId: row.contract_id ? String(row.contract_id) : null,
      reasonCode: row.reason_code as PostponementReasonCode,
      reasonNote: row.reason_note ? String(row.reason_note) : null,
      requestedBy: row.requested_by ? String(row.requested_by) : null,
      approvedBy: row.approved_by ? String(row.approved_by) : null,
      startsAt: requiredDate(row.starts_at as Date | string),
      restartAt: requiredDate(row.restart_at as Date | string),
      maxDays: Number(row.max_days ?? 14),
      status: row.status as PostponementStatus,
      createdAt: requiredDate(row.created_at as Date | string),
      updatedAt: requiredDate(row.updated_at as Date | string),
    };
  }
}
