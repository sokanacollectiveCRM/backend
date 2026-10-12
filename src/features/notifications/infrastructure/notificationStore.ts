import { queryCloudSql } from '../../../db/cloudSqlPool';
import { PAID_INSTALLMENT_STATUSES } from '../../portal/domain/eligibility';
import type { PostponementReason } from '../domain/postponement';

export interface SigningCandidate {
  contractId: string;
  clientId: string;
  status: string;
  windowStartedAt: Date;
  phase: 'standard' | 'resumed_at_day3';
  remindersDisabled: boolean;
  postponed: boolean;
  depositUnpaid: boolean;
  clientFirstName: string | null;
  clientEmail: string | null;
  doulaId: string | null;
  doulaEmail: string | null;
}

export interface BirthCandidate {
  clientId: string;
  clientFirstName: string | null;
  dueDate: Date | null;
  babyDeliveredAt: Date | null;
  outcomesLogged: boolean;
  postponed: boolean;
  doulaId: string | null;
  doulaEmail: string | null;
}

export interface NoteCandidate {
  assignmentId: string;
  clientId: string;
  clientFirstName: string | null;
  doulaId: string;
  doulaEmail: string | null;
  lastNoteId: string | null;
  lastActivityAt: Date;
  postponed: boolean;
}

const PAID = [...PAID_INSTALLMENT_STATUSES];

export class NotificationStore {
  async isKilled(): Promise<boolean> {
    if (process.env.NOTIFICATION_RULES_KILL_SWITCH === 'true') return true;
    const { rows } = await queryCloudSql<{ kill_switch: boolean }>(
      `SELECT kill_switch FROM public.notification_control WHERE id = 1`
    );
    return Boolean(rows[0]?.kill_switch);
  }

  async listSigningCandidates(): Promise<SigningCandidate[]> {
    const { rows } = await queryCloudSql<{
      contract_id: string;
      client_id: string;
      status: string;
      window_started_at: Date;
      phase: 'standard' | 'resumed_at_day3';
      reminders_disabled: boolean;
      postponed: boolean;
      deposit_unpaid: boolean;
      first_name: string | null;
      client_email: string | null;
      doula_id: string | null;
      doula_email: string | null;
    }>(
      `
      SELECT
        c.id AS contract_id,
        c.client_id,
        c.status,
        c.signing_window_started_at AS window_started_at,
        c.signing_window_phase AS phase,
        c.signing_reminders_disabled AS reminders_disabled,
        EXISTS (
          SELECT 1 FROM public.client_postponements p
          WHERE p.client_id = c.client_id AND p.status = 'active'
        ) AS postponed,
        (
          EXISTS (
            SELECT 1
            FROM public.payment_installments pi
            JOIN public.payment_schedules ps ON ps.id = pi.schedule_id
            WHERE ps.contract_id = c.id
              AND COALESCE(pi.payment_type, '') = 'deposit'
          )
          AND NOT EXISTS (
            SELECT 1
            FROM public.payment_installments pi
            JOIN public.payment_schedules ps ON ps.id = pi.schedule_id
            WHERE ps.contract_id = c.id
              AND COALESCE(pi.payment_type, '') = 'deposit'
              AND LOWER(COALESCE(pi.status, '')) = ANY($1::text[])
          )
          AND NOT EXISTS (
            SELECT 1 FROM public.payments pay WHERE pay.client_id = c.client_id
          )
        ) AS deposit_unpaid,
        cl.first_name,
        cl.email AS client_email,
        d.id AS doula_id,
        d.email AS doula_email
      FROM public.phi_contracts c
      JOIN public.phi_clients cl ON cl.id = c.client_id
      LEFT JOIN LATERAL (
        SELECT doulas.id, doulas.email
        FROM public.doula_assignments da
        JOIN public.doulas doulas ON doulas.id = da.doula_id
        WHERE da.client_id = c.client_id AND da.status = 'active'
        ORDER BY da.created_at DESC NULLS LAST
        LIMIT 1
      ) d ON TRUE
      WHERE c.signing_window_started_at IS NOT NULL
        AND c.status IN ('sent', 'viewed', 'partially_signed', 'signed')
      ORDER BY c.signing_window_started_at ASC
      LIMIT 100
      `,
      [PAID]
    );
    return rows.map((row) => ({
      contractId: row.contract_id,
      clientId: row.client_id,
      status: row.status,
      windowStartedAt: new Date(row.window_started_at),
      phase: row.phase === 'resumed_at_day3' ? 'resumed_at_day3' : 'standard',
      remindersDisabled: row.reminders_disabled,
      postponed: row.postponed,
      depositUnpaid: row.deposit_unpaid,
      clientFirstName: row.first_name,
      clientEmail: row.client_email,
      doulaId: row.doula_id,
      doulaEmail: row.doula_email,
    }));
  }

  async getSigningCandidate(
    contractId: string
  ): Promise<SigningCandidate | null> {
    const rows = await this.listSigningCandidates();
    return rows.find((row) => row.contractId === contractId) ?? null;
  }

  async listBirthCandidates(): Promise<BirthCandidate[]> {
    const { rows } = await queryCloudSql<{
      client_id: string;
      first_name: string | null;
      due_date: Date | null;
      baby_delivered_at: Date | null;
      outcomes_logged: boolean;
      postponed: boolean;
      doula_id: string | null;
      doula_email: string | null;
    }>(
      `
      SELECT
        cl.id AS client_id,
        cl.first_name,
        cl.due_date,
        cl.baby_delivered_at,
        (
          NULLIF(btrim(COALESCE(cl.birth_outcomes, '')), '') IS NOT NULL
          OR cl.birth_outcomes_induction IS NOT NULL
          OR NULLIF(btrim(COALESCE(cl.birth_outcomes_delivery_type, '')), '') IS NOT NULL
          OR COALESCE(cardinality(cl.birth_outcomes_medications_used), 0) > 0
        ) AS outcomes_logged,
        EXISTS (
          SELECT 1 FROM public.client_postponements p
          WHERE p.client_id = cl.id AND p.status = 'active'
        ) AS postponed,
        d.id AS doula_id,
        d.email AS doula_email
      FROM public.phi_clients cl
      LEFT JOIN LATERAL (
        SELECT doulas.id, doulas.email
        FROM public.doula_assignments da
        JOIN public.doulas doulas ON doulas.id = da.doula_id
        WHERE da.client_id = cl.id AND da.status = 'active'
        ORDER BY da.created_at DESC NULLS LAST
        LIMIT 1
      ) d ON TRUE
      WHERE (
          cl.baby_delivered_at IS NOT NULL
          OR (
            cl.due_date IS NOT NULL
            AND cl.due_date <= ((CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::date - 5)
          )
        )
        AND NOT (
          NULLIF(btrim(COALESCE(cl.birth_outcomes, '')), '') IS NOT NULL
          OR cl.birth_outcomes_induction IS NOT NULL
          OR NULLIF(btrim(COALESCE(cl.birth_outcomes_delivery_type, '')), '') IS NOT NULL
          OR COALESCE(cardinality(cl.birth_outcomes_medications_used), 0) > 0
        )
      ORDER BY COALESCE(cl.baby_delivered_at, cl.due_date) ASC
      LIMIT 100
      `
    );
    return rows.map((row) => ({
      clientId: row.client_id,
      clientFirstName: row.first_name,
      dueDate: row.due_date ? new Date(row.due_date) : null,
      babyDeliveredAt: row.baby_delivered_at
        ? new Date(row.baby_delivered_at)
        : null,
      outcomesLogged: row.outcomes_logged,
      postponed: row.postponed,
      doulaId: row.doula_id,
      doulaEmail: row.doula_email,
    }));
  }

  async listNoteCandidates(): Promise<NoteCandidate[]> {
    const { rows } = await queryCloudSql<{
      assignment_id: string;
      client_id: string;
      first_name: string | null;
      doula_id: string;
      doula_email: string | null;
      last_note_id: string | null;
      last_activity_at: Date;
      postponed: boolean;
    }>(
      `
      SELECT
        da.id AS assignment_id,
        da.client_id,
        cl.first_name,
        da.doula_id,
        doulas.email AS doula_email,
        note.id AS last_note_id,
        COALESCE(note.timestamp, da.created_at) AS last_activity_at,
        EXISTS (
          SELECT 1 FROM public.client_postponements p
          WHERE p.client_id = da.client_id AND p.status = 'active'
        ) AS postponed
      FROM public.doula_assignments da
      JOIN public.doulas doulas ON doulas.id = da.doula_id
      JOIN public.phi_clients cl ON cl.id = da.client_id
      LEFT JOIN LATERAL (
        SELECT id, timestamp
        FROM public.client_activities
        WHERE client_id = da.client_id AND type = 'note'
        ORDER BY timestamp DESC
        LIMIT 1
      ) note ON TRUE
      WHERE da.status = 'active'
      ORDER BY COALESCE(note.timestamp, da.created_at) ASC
      LIMIT 100
      `
    );
    return rows.map((row) => ({
      assignmentId: row.assignment_id,
      clientId: row.client_id,
      clientFirstName: row.first_name,
      doulaId: row.doula_id,
      doulaEmail: row.doula_email,
      lastNoteId: row.last_note_id,
      lastActivityAt: new Date(row.last_activity_at),
      postponed: row.postponed,
    }));
  }

  async claim(input: {
    dedupeKey: string;
    ruleId: string;
    channel: string;
    subjectType: string;
    subjectId: string;
  }): Promise<boolean> {
    const { rows } = await queryCloudSql<{ id: string }>(
      `
      INSERT INTO public.notification_deliveries (
        dedupe_key, rule_id, channel, subject_type, subject_id, status
      )
      VALUES ($1, $2, $3, $4, $5::uuid, 'pending')
      ON CONFLICT (dedupe_key) DO UPDATE
        SET status = 'pending', updated_at = CURRENT_TIMESTAMP
        WHERE notification_deliveries.status = 'failed'
           OR (
             notification_deliveries.status = 'pending'
             AND notification_deliveries.updated_at < CURRENT_TIMESTAMP - INTERVAL '10 minutes'
           )
      RETURNING id
      `,
      [
        input.dedupeKey,
        input.ruleId,
        input.channel,
        input.subjectType,
        input.subjectId,
      ]
    );
    return Boolean(rows[0]);
  }

  async markDelivery(
    dedupeKey: string,
    status: 'sent' | 'skipped' | 'failed'
  ): Promise<void> {
    await queryCloudSql(
      `UPDATE public.notification_deliveries
       SET status = $2, updated_at = CURRENT_TIMESTAMP
       WHERE dedupe_key = $1`,
      [dedupeKey, status]
    );
  }

  async releaseClaim(dedupeKey: string): Promise<void> {
    await queryCloudSql(
      `DELETE FROM public.notification_deliveries
       WHERE dedupe_key = $1 AND status = 'pending'`,
      [dedupeKey]
    );
  }

  async upsertNotice(input: {
    dedupeKey: string;
    audience: 'admin' | 'doula';
    doulaId?: string | null;
    clientId?: string | null;
    severity: 'info' | 'red';
    title: string;
    body: string;
    ruleId: string;
    blocksPayout?: boolean;
  }): Promise<void> {
    await queryCloudSql(
      `
      INSERT INTO public.dashboard_notices (
        dedupe_key, audience, doula_id, client_id, severity, title, body, rule_id, blocks_payout
      )
      VALUES ($1, $2, $3::uuid, $4::uuid, $5, $6, $7, $8, $9)
      ON CONFLICT (dedupe_key) DO NOTHING
      `,
      [
        input.dedupeKey,
        input.audience,
        input.doulaId ?? null,
        input.clientId ?? null,
        input.severity,
        input.title,
        input.body,
        input.ruleId,
        Boolean(input.blocksPayout),
      ]
    );
  }

  async resolveBirthNotices(): Promise<void> {
    await queryCloudSql(
      `
      UPDATE public.dashboard_notices n
      SET resolved_at = CURRENT_TIMESTAMP
      WHERE n.resolved_at IS NULL
        AND n.rule_id IN ('birth_outcomes_doula', 'birth_outcomes_admin')
        AND EXISTS (
          SELECT 1 FROM public.phi_clients cl
          WHERE cl.id = n.client_id
            AND (
              NULLIF(btrim(COALESCE(cl.birth_outcomes, '')), '') IS NOT NULL
              OR cl.birth_outcomes_induction IS NOT NULL
              OR NULLIF(btrim(COALESCE(cl.birth_outcomes_delivery_type, '')), '') IS NOT NULL
              OR COALESCE(cardinality(cl.birth_outcomes_medications_used), 0) > 0
            )
        )
      `
    );
  }

  async listNotices(audience: 'admin' | 'doula', doulaId?: string) {
    const { rows } = await queryCloudSql(
      `
      SELECT id, audience, client_id, severity, title, body, rule_id, blocks_payout, created_at
      FROM public.dashboard_notices
      WHERE resolved_at IS NULL
        AND audience = $1
        AND ($2::uuid IS NULL OR doula_id = $2::uuid)
      ORDER BY created_at DESC
      LIMIT 50
      `,
      [audience, doulaId ?? null]
    );
    return rows;
  }

  async listDuePostponements(): Promise<
    { id: string; clientId: string; restartOn: string }[]
  > {
    const { rows } = await queryCloudSql<{
      id: string;
      client_id: string;
      restart_on: string;
    }>(
      `
      SELECT id, client_id, restart_on::text
      FROM public.client_postponements
      WHERE status = 'active'
        AND restart_on <= (CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::date
      `
    );
    return rows.map((row) => ({
      id: row.id,
      clientId: row.client_id,
      restartOn: row.restart_on,
    }));
  }

  async restartPostponement(id: string, clientId: string): Promise<boolean> {
    const { rows } = await queryCloudSql<{ id: string }>(
      `
      UPDATE public.client_postponements
      SET status = 'restarted', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1::uuid AND client_id = $2::uuid AND status = 'active'
      RETURNING id
      `,
      [id, clientId]
    );
    if (!rows[0]) return false;
    await queryCloudSql(
      `
      UPDATE public.phi_contracts
      SET signing_window_started_at = CURRENT_TIMESTAMP,
          signing_window_phase = 'resumed_at_day3',
          updated_at = CURRENT_TIMESTAMP
      WHERE client_id = $1::uuid
        AND status IN ('sent', 'viewed', 'partially_signed', 'signed')
        AND signing_window_started_at IS NOT NULL
      `,
      [clientId]
    );
    await this.logPostponement(id, clientId, 'restarted', null, null);
    return true;
  }

  async createPostponement(input: {
    clientId: string;
    reason: PostponementReason;
    note: string | null;
    restartOn: string;
    status: 'active' | 'requested';
    requestedByRole: 'admin' | 'doula';
    actorId: string;
  }): Promise<string> {
    const { rows } = await queryCloudSql<{ id: string }>(
      `
      INSERT INTO public.client_postponements (
        client_id, reason, note, restart_on, status, requested_by_role, created_by
      )
      VALUES ($1::uuid, $2, $3, $4::date, $5, $6, $7::uuid)
      RETURNING id
      `,
      [
        input.clientId,
        input.reason,
        input.note,
        input.restartOn,
        input.status,
        input.requestedByRole,
        input.actorId,
      ]
    );
    const id = rows[0]?.id;
    if (!id) throw new Error('Postponement was not created');
    await this.logPostponement(
      id,
      input.clientId,
      input.status === 'active' ? 'postponed' : 'requested',
      input.actorId,
      input.note
    );
    return id;
  }

  async updatePostponement(input: {
    id: string;
    action: 'lifted' | 'canceled' | 'extended' | 'approved';
    actorId: string;
    restartOn?: string;
  }): Promise<{ clientId: string } | null> {
    if (input.action === 'extended' && input.restartOn) {
      const { rows } = await queryCloudSql<{ client_id: string }>(
        `
        UPDATE public.client_postponements
        SET restart_on = $2::date, status = 'active', updated_at = CURRENT_TIMESTAMP
        WHERE id = $1::uuid AND status = 'active'
        RETURNING client_id
        `,
        [input.id, input.restartOn]
      );
      if (!rows[0]) return null;
      await this.logPostponement(
        input.id,
        rows[0].client_id,
        'extended',
        input.actorId,
        input.restartOn
      );
      return { clientId: rows[0].client_id };
    }

    const nextStatus = input.action === 'approved' ? 'active' : input.action;
    const { rows } = await queryCloudSql<{ client_id: string }>(
      `
      UPDATE public.client_postponements
      SET status = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1::uuid
        AND status = ANY($3::text[])
      RETURNING client_id
      `,
      [
        input.id,
        nextStatus,
        input.action === 'approved'
          ? ['requested']
          : input.action === 'canceled'
            ? ['active', 'requested']
            : ['active'],
      ]
    );
    if (!rows[0]) return null;
    await this.logPostponement(
      input.id,
      rows[0].client_id,
      input.action,
      input.actorId,
      null
    );
    return { clientId: rows[0].client_id };
  }

  async getPostponement(id: string): Promise<{
    clientId: string;
    reason: PostponementReason;
    restartOn: string;
    status: string;
  } | null> {
    const { rows } = await queryCloudSql<{
      client_id: string;
      reason: PostponementReason;
      restart_on: string;
      status: string;
    }>(
      `
      SELECT client_id, reason, restart_on::text, status
      FROM public.client_postponements
      WHERE id = $1::uuid
      `,
      [id]
    );
    const row = rows[0];
    if (!row) return null;
    return {
      clientId: row.client_id,
      reason: row.reason,
      restartOn: row.restart_on,
      status: row.status,
    };
  }

  async assignedDoula(clientId: string): Promise<{
    id: string;
    email: string | null;
  } | null> {
    const { rows } = await queryCloudSql<{ id: string; email: string | null }>(
      `
      SELECT doulas.id, doulas.email
      FROM public.doula_assignments da
      JOIN public.doulas doulas ON doulas.id = da.doula_id
      WHERE da.client_id = $1::uuid AND da.status = 'active'
      ORDER BY da.created_at DESC NULLS LAST
      LIMIT 1
      `,
      [clientId]
    );
    return rows[0] ?? null;
  }

  async clientFirstName(clientId: string): Promise<string | null> {
    const { rows } = await queryCloudSql<{ first_name: string | null }>(
      `SELECT first_name FROM public.phi_clients WHERE id = $1::uuid`,
      [clientId]
    );
    return rows[0]?.first_name ?? null;
  }

  async doulaIsAssigned(clientId: string, doulaId: string): Promise<boolean> {
    const { rows } = await queryCloudSql<{ ok: boolean }>(
      `
      SELECT TRUE AS ok
      FROM public.doula_assignments
      WHERE client_id = $1::uuid AND doula_id = $2::uuid AND status = 'active'
      LIMIT 1
      `,
      [clientId, doulaId]
    );
    return Boolean(rows[0]);
  }

  private async logPostponement(
    postponementId: string,
    clientId: string,
    action: string,
    actorId: string | null,
    note: string | null
  ): Promise<void> {
    await queryCloudSql(
      `
      INSERT INTO public.postponement_events (
        postponement_id, client_id, action, actor_id, note
      )
      VALUES ($1::uuid, $2::uuid, $3, $4::uuid, $5)
      `,
      [postponementId, clientId, action, actorId, note]
    );
  }
}
