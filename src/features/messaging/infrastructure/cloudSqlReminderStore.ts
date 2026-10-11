import { getPool, queryCloudSql } from '../../../db/cloudSqlPool';
import {
  DEPOSIT_PAYMENT_TYPE,
  PAID_INSTALLMENT_STATUSES,
} from '../../portal/domain/eligibility';
import {
  CreateRunInput,
  ListFilter,
  ReminderStore,
  SendLogInsert,
} from '../application/reminderStore';
import { parseStopConditions } from '../domain/stopConditions';
import {
  AdminAlert,
  ClientFacts,
  ClientPostponement,
  ContractFacts,
  MessageTemplate,
  MessagingSettings,
  PolicyWithSteps,
  PostponementEvent,
  ReminderPolicy,
  ReminderPolicyStep,
  ReminderRun,
  ReminderSendLog,
  SendStatus,
} from '../domain/types';

type SqlDeps = {
  voidContract?: (contractId: string) => Promise<void>;
  mintSigningLink?: (
    contractId: string,
    clientId: string
  ) => Promise<string | null>;
  frontendUrl?: string;
};

function asDate(value: unknown): Date {
  if (value instanceof Date) return value;
  return new Date(String(value));
}

function asDateOrNull(value: unknown): Date | null {
  if (value == null) return null;
  const d = asDate(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function pageArgs(filter: ListFilter): { limit: number; offset: number } {
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 20));
  return { limit: pageSize, offset: (page - 1) * pageSize };
}

function mapPolicy(row: any): ReminderPolicy {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    enabled: row.enabled,
    trigger_event: row.trigger_event,
    anchor_field: row.anchor_field,
    stop_conditions: parseStopConditions(row.stop_conditions),
    end_action: row.end_action,
    end_action_delay_value: row.end_action_delay_value,
    end_action_delay_unit: row.end_action_delay_unit,
    end_action_template_keys: row.end_action_template_keys || [],
    notify_admin_email: row.notify_admin_email,
    alert_admin_after_sends: row.alert_admin_after_sends,
    config: row.config || {},
    updated_by: row.updated_by,
    updated_at: asDate(row.updated_at),
  };
}

function mapStep(row: any): ReminderPolicyStep {
  return {
    id: row.id,
    policy_id: row.policy_id,
    step_order: row.step_order,
    delay_value: row.delay_value,
    delay_unit: row.delay_unit,
    repeat_every_value: row.repeat_every_value,
    repeat_every_unit: row.repeat_every_unit,
    channel: row.channel,
    recipient_roles: row.recipient_roles || [],
    template_id: row.template_id,
    enabled: row.enabled,
  };
}

function mapTemplate(row: any): MessageTemplate {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    channel: row.channel,
    subject: row.subject,
    body_text: row.body_text,
    body_html: row.body_html,
    version: row.version,
    updated_by: row.updated_by,
    updated_at: asDate(row.updated_at),
  };
}

function mapRun(row: any): ReminderRun {
  return {
    id: row.id,
    policy_id: row.policy_id,
    policy_key: row.policy_key,
    subject_type: row.subject_type,
    subject_id: row.subject_id,
    client_id: row.client_id,
    contract_id: row.contract_id,
    doula_id: row.doula_id,
    status: row.status,
    anchor_at: asDate(row.anchor_at),
    current_step: row.current_step,
    next_due_at: asDateOrNull(row.next_due_at),
    end_action_due_at: asDateOrNull(row.end_action_due_at),
    sends_count: row.sends_count,
    pause_reason: row.pause_reason,
    completed_reason: row.completed_reason,
    admin_alerted: row.admin_alerted,
  };
}

export class CloudSqlReminderStore implements ReminderStore {
  constructor(private readonly deps: SqlDeps = {}) {}

  private async withPolicy(policy: ReminderPolicy): Promise<PolicyWithSteps> {
    const { rows } = await queryCloudSql(
      `SELECT * FROM public.reminder_policy_steps WHERE policy_id = $1::uuid ORDER BY step_order`,
      [policy.id]
    );
    return { ...policy, steps: rows.map(mapStep) };
  }

  async getSettings(): Promise<MessagingSettings> {
    const { rows } = await queryCloudSql(
      `SELECT * FROM public.messaging_settings ORDER BY id LIMIT 1`
    );
    const overdue = await queryCloudSql<{ overdue_days: number }>(
      `SELECT COALESCE((config->>'overdue_days')::int, 7) AS overdue_days
       FROM public.reminder_policies WHERE key = 'overdue_notes' LIMIT 1`
    );
    const row = rows[0] || {};
    return {
      reminders_enabled: row.reminders_enabled !== false,
      test_recipient_override_email: row.test_recipient_override_email ?? null,
      contact_email: row.contact_email || 'hello@sokanacollective.com',
      admin_notification_email:
        row.admin_notification_email || 'hello@sokanacollective.com',
      billing_notification_email:
        row.billing_notification_email ||
        process.env.BILLING_NOTIFICATION_EMAIL ||
        'billing@sokanacollective.com',
      evaluation_link: row.evaluation_link ?? null,
      overdue_days: overdue.rows[0]?.overdue_days ?? 7,
      test_tools_enabled: process.env.REMINDER_TEST_TOOLS_ENABLED === 'true',
    };
  }

  async updateSettings(
    patch: Partial<
      Omit<MessagingSettings, 'overdue_days' | 'test_tools_enabled'>
    >,
    actorId: string | null
  ): Promise<MessagingSettings> {
    const current = await this.getSettings();
    const next = { ...current, ...patch };
    await queryCloudSql(
      `INSERT INTO public.messaging_settings (
         id, reminders_enabled, test_recipient_override_email, contact_email,
         admin_notification_email, billing_notification_email, evaluation_link, updated_by, updated_at
       ) VALUES (
         true, $1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP
       )
       ON CONFLICT (id) DO UPDATE SET
         reminders_enabled = EXCLUDED.reminders_enabled,
         test_recipient_override_email = EXCLUDED.test_recipient_override_email,
         contact_email = EXCLUDED.contact_email,
         admin_notification_email = EXCLUDED.admin_notification_email,
         billing_notification_email = EXCLUDED.billing_notification_email,
         evaluation_link = EXCLUDED.evaluation_link,
         updated_by = EXCLUDED.updated_by,
         updated_at = CURRENT_TIMESTAMP`,
      [
        next.reminders_enabled,
        next.test_recipient_override_email,
        next.contact_email,
        next.admin_notification_email,
        next.billing_notification_email,
        next.evaluation_link,
        actorId,
      ]
    );
    return this.getSettings();
  }

  async listPolicies(): Promise<PolicyWithSteps[]> {
    const { rows } = await queryCloudSql(
      `SELECT * FROM public.reminder_policies ORDER BY name`
    );
    const result: PolicyWithSteps[] = [];
    for (const row of rows) result.push(await this.withPolicy(mapPolicy(row)));
    return result;
  }

  async getPolicy(id: string): Promise<PolicyWithSteps | null> {
    const { rows } = await queryCloudSql(
      `SELECT * FROM public.reminder_policies WHERE id = $1::uuid`,
      [id]
    );
    return rows[0] ? this.withPolicy(mapPolicy(rows[0])) : null;
  }

  async getPolicyByKey(key: string): Promise<PolicyWithSteps | null> {
    const { rows } = await queryCloudSql(
      `SELECT * FROM public.reminder_policies WHERE key = $1`,
      [key]
    );
    return rows[0] ? this.withPolicy(mapPolicy(rows[0])) : null;
  }

  async updatePolicy(
    id: string,
    patch: Partial<ReminderPolicy>,
    actorId: string | null
  ): Promise<PolicyWithSteps | null> {
    const current = await this.getPolicy(id);
    if (!current) return null;
    const next = { ...current, ...patch };
    await queryCloudSql(
      `UPDATE public.reminder_policies SET
         name = $2, description = $3, enabled = $4, stop_conditions = $5::jsonb,
         end_action = $6, end_action_delay_value = $7, end_action_delay_unit = $8,
         end_action_template_keys = $9::jsonb, notify_admin_email = $10,
         alert_admin_after_sends = $11, config = $12::jsonb,
         updated_by = $13, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1::uuid`,
      [
        id,
        next.name,
        next.description,
        next.enabled,
        JSON.stringify(next.stop_conditions),
        next.end_action,
        next.end_action_delay_value,
        next.end_action_delay_unit,
        JSON.stringify(next.end_action_template_keys),
        next.notify_admin_email,
        next.alert_admin_after_sends,
        JSON.stringify(next.config),
        actorId,
      ]
    );
    return this.getPolicy(id);
  }

  async replaceSteps(
    id: string,
    steps: Array<Omit<ReminderPolicyStep, 'id' | 'policy_id'>>,
    actorId: string | null
  ): Promise<PolicyWithSteps | null> {
    const current = await this.getPolicy(id);
    if (!current) return null;
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `DELETE FROM public.reminder_policy_steps WHERE policy_id = $1::uuid`,
        [id]
      );
      for (const step of steps) {
        await client.query(
          `INSERT INTO public.reminder_policy_steps (
             policy_id, step_order, delay_value, delay_unit, repeat_every_value,
             repeat_every_unit, channel, recipient_roles, template_id, enabled
           ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8::text[], $9::uuid, $10)`,
          [
            id,
            step.step_order,
            step.delay_value,
            step.delay_unit,
            step.repeat_every_value,
            step.repeat_every_unit,
            step.channel,
            step.recipient_roles,
            step.template_id,
            step.enabled,
          ]
        );
      }
      await client.query(
        `UPDATE public.reminder_policies SET updated_by = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1::uuid`,
        [id, actorId]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    return this.getPolicy(id);
  }

  async listTemplates(): Promise<MessageTemplate[]> {
    const { rows } = await queryCloudSql(
      `SELECT * FROM public.message_templates ORDER BY name`
    );
    return rows.map(mapTemplate);
  }

  async getTemplate(id: string): Promise<MessageTemplate | null> {
    const { rows } = await queryCloudSql(
      `SELECT * FROM public.message_templates WHERE id = $1::uuid`,
      [id]
    );
    return rows[0] ? mapTemplate(rows[0]) : null;
  }

  async getTemplateByKey(key: string): Promise<MessageTemplate | null> {
    const { rows } = await queryCloudSql(
      `SELECT * FROM public.message_templates WHERE key = $1`,
      [key]
    );
    return rows[0] ? mapTemplate(rows[0]) : null;
  }

  async updateTemplate(
    id: string,
    patch: Partial<
      Pick<
        MessageTemplate,
        'name' | 'channel' | 'subject' | 'body_text' | 'body_html'
      >
    >,
    actorId: string | null
  ): Promise<MessageTemplate | null> {
    const current = await this.getTemplate(id);
    if (!current) return null;
    const next = { ...current, ...patch };
    await queryCloudSql(
      `UPDATE public.message_templates SET
         name = $2, channel = $3, subject = $4, body_text = $5, body_html = $6,
         version = version + 1, updated_by = $7, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1::uuid`,
      [
        id,
        next.name,
        next.channel,
        next.subject,
        next.body_text,
        next.body_html,
        actorId,
      ]
    );
    return this.getTemplate(id);
  }

  async findActiveOrPausedRun(
    policyId: string,
    subjectType: string,
    subjectId: string
  ): Promise<ReminderRun | null> {
    const { rows } = await queryCloudSql(
      `SELECT r.*, p.key AS policy_key
       FROM public.reminder_runs r
       JOIN public.reminder_policies p ON p.id = r.policy_id
       WHERE r.policy_id = $1::uuid AND r.subject_type = $2 AND r.subject_id = $3
         AND r.status IN ('active', 'paused')
       LIMIT 1`,
      [policyId, subjectType, subjectId]
    );
    return rows[0] ? mapRun(rows[0]) : null;
  }

  async getRun(id: string): Promise<ReminderRun | null> {
    const { rows } = await queryCloudSql(
      `SELECT r.*, p.key AS policy_key
       FROM public.reminder_runs r
       JOIN public.reminder_policies p ON p.id = r.policy_id
       WHERE r.id = $1::uuid`,
      [id]
    );
    return rows[0] ? mapRun(rows[0]) : null;
  }

  async createRun(input: CreateRunInput): Promise<ReminderRun> {
    const existing = await this.findActiveOrPausedRun(
      input.policy.id,
      input.subjectType,
      input.subjectId
    );
    if (existing) return existing;
    const { rows } = await queryCloudSql(
      `INSERT INTO public.reminder_runs (
         policy_id, subject_type, subject_id, client_id, contract_id, doula_id,
         status, anchor_at, current_step, next_due_at, end_action_due_at, pause_reason
       ) VALUES (
         $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
       )
       ON CONFLICT (policy_id, subject_type, subject_id) WHERE status IN ('active', 'paused') DO NOTHING
       RETURNING *`,
      [
        input.policy.id,
        input.subjectType,
        input.subjectId,
        input.clientId ?? null,
        input.contractId ?? null,
        input.doulaId ?? null,
        input.status,
        input.anchorAt,
        input.currentStep,
        input.nextDueAt,
        input.endActionDueAt,
        input.pauseReason ?? null,
      ]
    );
    if (rows[0]) {
      return mapRun({ ...rows[0], policy_key: input.policy.key });
    }
    const raced = await this.findActiveOrPausedRun(
      input.policy.id,
      input.subjectType,
      input.subjectId
    );
    if (!raced) throw new Error('Failed to create reminder run');
    return raced;
  }

  async updateRun(
    id: string,
    patch: Partial<ReminderRun>
  ): Promise<ReminderRun | null> {
    const current = await this.getRun(id);
    if (!current) return null;
    const next = { ...current, ...patch };
    await queryCloudSql(
      `UPDATE public.reminder_runs SET
         status = $2, anchor_at = $3, current_step = $4, next_due_at = $5,
         end_action_due_at = $6, sends_count = $7, pause_reason = $8,
         completed_reason = $9, admin_alerted = $10, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1::uuid`,
      [
        id,
        next.status,
        next.anchor_at,
        next.current_step,
        next.next_due_at,
        next.end_action_due_at,
        next.sends_count,
        next.pause_reason,
        next.completed_reason,
        next.admin_alerted,
      ]
    );
    return this.getRun(id);
  }

  async listRuns(
    filter: ListFilter
  ): Promise<{ rows: ReminderRun[]; total: number }> {
    const { limit, offset } = pageArgs(filter);
    const where: string[] = ['1=1'];
    const params: unknown[] = [];
    if (filter.status) {
      params.push(filter.status);
      where.push(`r.status = $${params.length}`);
    }
    if (filter.policyKey) {
      params.push(filter.policyKey);
      where.push(`p.key = $${params.length}`);
    }
    if (filter.clientId) {
      params.push(filter.clientId);
      where.push(`r.client_id = $${params.length}::uuid`);
    }
    if (filter.contractId) {
      params.push(filter.contractId);
      where.push(`r.contract_id = $${params.length}::uuid`);
    }
    const whereSql = where.join(' AND ');
    const count = await queryCloudSql<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM public.reminder_runs r
       JOIN public.reminder_policies p ON p.id = r.policy_id
       WHERE ${whereSql}`,
      params
    );
    params.push(limit, offset);
    const { rows } = await queryCloudSql(
      `SELECT r.*, p.key AS policy_key
       FROM public.reminder_runs r
       JOIN public.reminder_policies p ON p.id = r.policy_id
       WHERE ${whereSql}
       ORDER BY r.next_due_at NULLS LAST, r.created_at
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return { rows: rows.map(mapRun), total: Number(count.rows[0]?.count || 0) };
  }

  async listRunsForContract(contractId: string): Promise<ReminderRun[]> {
    const { rows } = await queryCloudSql(
      `SELECT r.*, p.key AS policy_key
       FROM public.reminder_runs r
       JOIN public.reminder_policies p ON p.id = r.policy_id
       WHERE r.contract_id = $1::uuid`,
      [contractId]
    );
    return rows.map(mapRun);
  }

  async pauseRunsForClient(
    clientId: string,
    contractId: string | null,
    reason: string
  ): Promise<number> {
    const result = await queryCloudSql(
      `UPDATE public.reminder_runs
       SET status = 'paused', pause_reason = $3, updated_at = CURRENT_TIMESTAMP
       WHERE status = 'active' AND client_id = $1::uuid
         AND ($2::uuid IS NULL OR contract_id IS NULL OR contract_id = $2::uuid)`,
      [clientId, contractId, reason]
    );
    return result.rowCount || 0;
  }

  async claimDueRuns(now: Date, limit: number): Promise<ReminderRun[]> {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `WITH due AS (
           SELECT r.id
           FROM public.reminder_runs r
           WHERE r.status = 'active'
             AND (
               (r.next_due_at IS NOT NULL AND r.next_due_at <= $1)
               OR (r.end_action_due_at IS NOT NULL AND r.end_action_due_at <= $1)
             )
           ORDER BY r.next_due_at NULLS LAST, r.id
           FOR UPDATE SKIP LOCKED
           LIMIT $2
         )
         SELECT r.*, p.key AS policy_key
         FROM public.reminder_runs r
         JOIN due ON due.id = r.id
         JOIN public.reminder_policies p ON p.id = r.policy_id`,
        [now, limit]
      );
      await client.query('COMMIT');
      return rows.map(mapRun);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async tryInsertSendLog(
    entry: SendLogInsert
  ): Promise<ReminderSendLog | 'duplicate'> {
    try {
      const { rows } = await queryCloudSql(
        `INSERT INTO public.reminder_send_log (
           run_id, policy_key, step_order, template_key, template_version,
           idempotency_key, recipient_role, recipient_email, channel, status,
           suppress_reason, error_class
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING *`,
        [
          entry.runId,
          entry.policyKey,
          entry.stepOrder,
          entry.templateKey,
          entry.templateVersion,
          entry.idempotencyKey,
          entry.recipientRole,
          entry.recipientEmail,
          entry.channel,
          entry.status,
          entry.suppressReason ?? null,
          entry.errorClass ?? null,
        ]
      );
      const row = rows[0];
      return {
        id: row.id,
        run_id: row.run_id,
        policy_key: row.policy_key,
        step_order: row.step_order,
        template_key: row.template_key,
        template_version: row.template_version,
        idempotency_key: row.idempotency_key,
        recipient_role: row.recipient_role,
        recipient_email: row.recipient_email,
        channel: row.channel,
        status: row.status,
        suppress_reason: row.suppress_reason,
        error_class: row.error_class,
        created_at: asDate(row.created_at),
      };
    } catch (error: any) {
      if (error?.code === '23505') return 'duplicate';
      throw error;
    }
  }

  async updateSendLog(
    id: string,
    patch: Partial<
      Pick<ReminderSendLog, 'status' | 'error_class' | 'suppress_reason'>
    >
  ): Promise<void> {
    await queryCloudSql(
      `UPDATE public.reminder_send_log
       SET status = COALESCE($2, status),
           error_class = COALESCE($3, error_class),
           suppress_reason = COALESCE($4, suppress_reason)
       WHERE id = $1::uuid`,
      [
        id,
        patch.status ?? null,
        patch.error_class ?? null,
        patch.suppress_reason ?? null,
      ]
    );
  }

  async listSendLog(
    filter: ListFilter
  ): Promise<{ rows: ReminderSendLog[]; total: number }> {
    const { limit, offset } = pageArgs(filter);
    const { rows } = await queryCloudSql(
      `SELECT * FROM public.reminder_send_log
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    const count = await queryCloudSql<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM public.reminder_send_log`
    );
    return {
      total: Number(count.rows[0]?.count || 0),
      rows: rows.map((row) => ({
        id: row.id,
        run_id: row.run_id,
        policy_key: row.policy_key,
        step_order: row.step_order,
        template_key: row.template_key,
        template_version: row.template_version,
        idempotency_key: row.idempotency_key,
        recipient_role: row.recipient_role,
        recipient_email: row.recipient_email,
        channel: row.channel,
        status: row.status,
        suppress_reason: row.suppress_reason,
        error_class: row.error_class,
        created_at: asDate(row.created_at),
      })),
    };
  }

  async countSendsForRunStep(
    runId: string,
    stepOrder: number,
    statuses: SendStatus[] = ['sent']
  ): Promise<number> {
    const { rows } = await queryCloudSql<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM public.reminder_send_log
       WHERE run_id = $1::uuid AND step_order = $2 AND status = ANY($3::text[])`,
      [runId, stepOrder, statuses]
    );
    return Number(rows[0]?.count || 0);
  }

  async listPostponements(clientId: string): Promise<ClientPostponement[]> {
    const { rows } = await queryCloudSql(
      `SELECT * FROM public.client_postponements WHERE client_id = $1::uuid ORDER BY starts_at DESC`,
      [clientId]
    );
    return rows.map(this.mapPostponement);
  }

  async getPostponement(id: string): Promise<ClientPostponement | null> {
    const { rows } = await queryCloudSql(
      `SELECT * FROM public.client_postponements WHERE id = $1::uuid`,
      [id]
    );
    return rows[0] ? this.mapPostponement(rows[0]) : null;
  }

  async createPostponement(
    input: Omit<ClientPostponement, 'id' | 'warning'> & {
      warning?: string | null;
    }
  ): Promise<ClientPostponement> {
    const { rows } = await queryCloudSql(
      `INSERT INTO public.client_postponements (
         client_id, contract_id, reason_code, reason_note, requested_by, approved_by,
         starts_at, restart_at, max_days, status
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        input.client_id,
        input.contract_id,
        input.reason_code,
        input.reason_note,
        input.requested_by,
        input.approved_by,
        input.starts_at,
        input.restart_at,
        input.max_days,
        input.status,
      ]
    );
    return this.mapPostponement(rows[0]);
  }

  async updatePostponement(
    id: string,
    patch: Partial<ClientPostponement>
  ): Promise<ClientPostponement | null> {
    const current = await this.getPostponement(id);
    if (!current) return null;
    const next = { ...current, ...patch };
    await queryCloudSql(
      `UPDATE public.client_postponements SET
         reason_code = $2, reason_note = $3, approved_by = $4, restart_at = $5, status = $6
       WHERE id = $1::uuid`,
      [
        id,
        next.reason_code,
        next.reason_note,
        next.approved_by,
        next.restart_at,
        next.status,
      ]
    );
    return this.getPostponement(id);
  }

  async appendPostponementEvent(
    input: Omit<PostponementEvent, 'id' | 'created_at'>
  ): Promise<PostponementEvent> {
    const { rows } = await queryCloudSql(
      `INSERT INTO public.client_postponement_events (postponement_id, event_type, actor_id, payload)
       VALUES ($1::uuid, $2, $3, $4::jsonb)
       RETURNING *`,
      [
        input.postponement_id,
        input.event_type,
        input.actor_id,
        JSON.stringify(input.payload),
      ]
    );
    const row = rows[0];
    return {
      id: row.id,
      postponement_id: row.postponement_id,
      event_type: row.event_type,
      actor_id: row.actor_id,
      payload: row.payload || {},
      created_at: asDate(row.created_at),
    };
  }

  async findActivePostponement(
    clientId: string,
    contractId?: string | null
  ): Promise<ClientPostponement | null> {
    const { rows } = await queryCloudSql(
      `SELECT * FROM public.client_postponements
       WHERE client_id = $1::uuid AND status = 'active'
         AND ($2::uuid IS NULL OR contract_id IS NULL OR contract_id = $2::uuid)
       ORDER BY starts_at DESC
       LIMIT 1`,
      [clientId, contractId ?? null]
    );
    return rows[0] ? this.mapPostponement(rows[0]) : null;
  }

  async listDuePostponementRestarts(now: Date): Promise<ClientPostponement[]> {
    const { rows } = await queryCloudSql(
      `SELECT * FROM public.client_postponements
       WHERE status = 'active' AND restart_at <= $1`,
      [now]
    );
    return rows.map(this.mapPostponement);
  }

  async createAlert(
    input: Omit<
      AdminAlert,
      'id' | 'created_at' | 'acknowledged_by' | 'acknowledged_at'
    >
  ): Promise<AdminAlert> {
    const { rows } = await queryCloudSql(
      `INSERT INTO public.admin_alerts (type, client_id, contract_id, run_id, message)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [
        input.type,
        input.client_id,
        input.contract_id,
        input.run_id,
        input.message,
      ]
    );
    return this.mapAlert(rows[0]);
  }

  async listAlerts(
    filter: ListFilter
  ): Promise<{ rows: AdminAlert[]; total: number }> {
    const { limit, offset } = pageArgs(filter);
    const ackSql =
      filter.acknowledged === true
        ? 'WHERE acknowledged_at IS NOT NULL'
        : filter.acknowledged === false
          ? 'WHERE acknowledged_at IS NULL'
          : '';
    const { rows } = await queryCloudSql(
      `SELECT * FROM public.admin_alerts ${ackSql} ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    const count = await queryCloudSql<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM public.admin_alerts ${ackSql}`
    );
    return {
      rows: rows.map(this.mapAlert),
      total: Number(count.rows[0]?.count || 0),
    };
  }

  async ackAlert(id: string, actorId: string): Promise<AdminAlert | null> {
    const { rows } = await queryCloudSql(
      `UPDATE public.admin_alerts
       SET acknowledged_by = $2, acknowledged_at = CURRENT_TIMESTAMP
       WHERE id = $1::uuid
       RETURNING *`,
      [id, actorId]
    );
    return rows[0] ? this.mapAlert(rows[0]) : null;
  }

  async loadContractFacts(contractId: string): Promise<ContractFacts | null> {
    const { rows } = await queryCloudSql(
      `SELECT
         c.id, c.client_id, c.status, c.sent_at,
         COALESCE(c.reminders_stopped, false) AS reminders_stopped,
         pc.email AS client_email, pc.first_name, pc.last_name,
         da.doula_id, d.full_name AS doula_name, d.email AS doula_email,
         EXISTS (
           SELECT 1 FROM public.payment_schedules ps
           JOIN public.payment_installments pi ON pi.schedule_id = ps.id
           WHERE ps.contract_id = c.id
             AND COALESCE(pi.payment_type, '') = $2
             AND COALESCE(pi.amount, 0) > 0
         ) AS deposit_due,
         EXISTS (
           SELECT 1 FROM public.payment_schedules ps
           JOIN public.payment_installments pi ON pi.schedule_id = ps.id
           WHERE ps.contract_id = c.id
             AND COALESCE(pi.payment_type, '') = $2
             AND LOWER(COALESCE(pi.status, '')) = ANY($3::text[])
         ) AS deposit_paid
       FROM public.phi_contracts c
       LEFT JOIN public.phi_clients pc ON pc.id = c.client_id
       LEFT JOIN LATERAL (
         SELECT doula_id FROM public.doula_assignments
         WHERE client_id = c.client_id AND status = 'active'
         LIMIT 1
       ) da ON true
       LEFT JOIN public.doulas d ON d.id = da.doula_id
       WHERE c.id = $1::uuid`,
      [contractId, DEPOSIT_PAYMENT_TYPE, [...PAID_INSTALLMENT_STATUSES]]
    );
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      clientId: row.client_id,
      status: row.status,
      sentAt: asDateOrNull(row.sent_at),
      clientEmail: row.client_email,
      clientFirstName: row.first_name || '',
      clientLastName: row.last_name || '',
      doulaId: row.doula_id,
      doulaName: row.doula_name,
      doulaEmail: row.doula_email,
      depositDue: Boolean(row.deposit_due),
      depositPaid: Boolean(row.deposit_paid),
      remindersStopped: Boolean(row.reminders_stopped),
      contractedHours: null,
    };
  }

  async loadClientFacts(clientId: string): Promise<ClientFacts | null> {
    const { rows } = await queryCloudSql(
      `SELECT
         pc.id, pc.first_name, pc.last_name, pc.email, pc.status, pc.due_date,
         (pc.birth_outcomes_induction IS NOT NULL
           AND pc.birth_outcomes_delivery_type IS NOT NULL
           AND COALESCE(cardinality(pc.birth_outcomes_medications_used), 0) > 0
         ) AS birth_outcomes_recorded,
         da.doula_id, d.full_name AS doula_name, d.email AS doula_email,
         (SELECT MAX(a.timestamp) FROM public.client_activities a WHERE a.client_id = pc.id) AS last_note_at,
         COALESCE(r.card_on_file, false) AS card_on_file,
         COALESCE(r.deposit_paid, false) AS deposit_paid,
         COALESCE((
           SELECT SUM(EXTRACT(EPOCH FROM (h.end_time - h.start_time))/3600)
           FROM public.hours h
           WHERE h.client_id = pc.id AND h.type = 'postpartum'
         ), 0) AS postpartum_hours
       FROM public.phi_clients pc
       LEFT JOIN LATERAL (
         SELECT doula_id FROM public.doula_assignments
         WHERE client_id = pc.id AND status = 'active' LIMIT 1
       ) da ON true
       LEFT JOIN public.doulas d ON d.id = da.doula_id
       LEFT JOIN public.client_onboarding_readiness r ON r.client_id = pc.id
       WHERE pc.id = $1::uuid`,
      [clientId]
    );
    const row = rows[0];
    if (!row) return null;
    return this.mapClientFacts(row);
  }

  async listOverdueNoteClients(
    overdueDays: number,
    now: Date
  ): Promise<ClientFacts[]> {
    const { rows } = await queryCloudSql(
      `SELECT pc.id FROM public.phi_clients pc
       LEFT JOIN LATERAL (
         SELECT MAX(timestamp) AS last_note_at
         FROM public.client_activities a WHERE a.client_id = pc.id
       ) n ON true
       WHERE COALESCE(n.last_note_at, pc.created_at, '-infinity'::timestamptz)
             < ($1::timestamptz - make_interval(days => $2))
         AND pc.status IN ('active', 'contract', 'Matched', 'matched')`,
      [now, overdueDays]
    );
    const facts: ClientFacts[] = [];
    for (const row of rows) {
      const item = await this.loadClientFacts(row.id);
      if (item) facts.push(item);
    }
    return facts;
  }

  async listDueDateScanClients(
    daysAfter: number,
    now: Date
  ): Promise<ClientFacts[]> {
    const { rows } = await queryCloudSql(
      `SELECT id FROM public.phi_clients
       WHERE due_date IS NOT NULL
         AND (due_date + make_interval(days => $2))::date <= ($1::timestamptz)::date
         AND NOT (
           birth_outcomes_induction IS NOT NULL
           AND birth_outcomes_delivery_type IS NOT NULL
           AND COALESCE(cardinality(birth_outcomes_medications_used), 0) > 0
         )`,
      [now, daysAfter]
    );
    const facts: ClientFacts[] = [];
    for (const row of rows) {
      const item = await this.loadClientFacts(row.id);
      if (item) facts.push(item);
    }
    return facts;
  }

  async listBabyDeliveredClients(_now: Date): Promise<ClientFacts[]> {
    return [];
  }

  async listHoursLowClients(
    remainingHours: number,
    remainingPct: number
  ): Promise<ClientFacts[]> {
    void remainingHours;
    void remainingPct;
    return [];
  }

  async listCardMissingAfterDeposit(): Promise<ClientFacts[]> {
    const { rows } = await queryCloudSql(
      `SELECT client_id AS id FROM public.client_onboarding_readiness
       WHERE deposit_paid = true AND COALESCE(card_on_file, false) = false`
    );
    const facts: ClientFacts[] = [];
    for (const row of rows) {
      const item = await this.loadClientFacts(row.id);
      if (item) facts.push(item);
    }
    return facts;
  }

  async mintSigningLink(
    contractId: string,
    clientId: string
  ): Promise<string | null> {
    if (this.deps.mintSigningLink) {
      return this.deps.mintSigningLink(contractId, clientId);
    }
    return null;
  }

  async voidUnsignedContract(
    contractId: string
  ): Promise<ContractFacts | null> {
    const facts = await this.loadContractFacts(contractId);
    if (!facts || facts.status === 'signed') return facts;
    if (this.deps.voidContract) {
      await this.deps.voidContract(contractId);
    }
    return this.loadContractFacts(contractId);
  }

  async setContractRemindersStopped(
    contractId: string,
    stopped: boolean,
    reason?: string | null
  ): Promise<ContractFacts | null> {
    await queryCloudSql(
      `UPDATE public.phi_contracts
       SET reminders_stopped = $2,
           reminders_stopped_at = CASE WHEN $2 THEN CURRENT_TIMESTAMP ELSE NULL END,
           reminders_stopped_reason = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1::uuid`,
      [contractId, stopped, reason ?? null]
    );
    return this.loadContractFacts(contractId);
  }

  private mapPostponement(row: any): ClientPostponement {
    return {
      id: row.id,
      client_id: row.client_id,
      contract_id: row.contract_id,
      reason_code: row.reason_code,
      reason_note: row.reason_note,
      requested_by: row.requested_by,
      approved_by: row.approved_by,
      starts_at: asDate(row.starts_at),
      restart_at: asDate(row.restart_at),
      max_days: row.max_days,
      status: row.status,
      warning: null,
    };
  }

  private mapAlert(row: any): AdminAlert {
    return {
      id: row.id,
      type: row.type,
      client_id: row.client_id,
      contract_id: row.contract_id,
      run_id: row.run_id,
      message: row.message,
      created_at: asDate(row.created_at),
      acknowledged_by: row.acknowledged_by,
      acknowledged_at: asDateOrNull(row.acknowledged_at),
    };
  }

  private mapClientFacts(row: any): ClientFacts {
    return {
      id: row.id,
      firstName: row.first_name || '',
      lastName: row.last_name || '',
      email: row.email,
      status: row.status,
      dueDate: asDateOrNull(row.due_date),
      babyDeliveredAt: null,
      birthOutcomesRecorded: Boolean(row.birth_outcomes_recorded),
      doulaId: row.doula_id,
      doulaName: row.doula_name,
      doulaEmail: row.doula_email,
      lastNoteAt: asDateOrNull(row.last_note_at),
      cardOnFile: Boolean(row.card_on_file),
      depositPaid: Boolean(row.deposit_paid),
      postpartumHours: Number(row.postpartum_hours || 0),
      contractedHours: null,
    };
  }
}
