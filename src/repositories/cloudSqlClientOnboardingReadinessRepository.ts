import { getPool } from '../db/cloudSqlPool';
import {
  BillingPath,
  OnboardingEventType,
  PortalBlockerCode,
  PortalEligibilitySnapshot,
} from '../constants/portalEligibility';

export interface ClientOnboardingReadinessRow {
  id: string;
  client_id: string;
  contract_signed: boolean;
  deposit_paid: boolean;
  billing_path: string | null;
  payment_authorization_required: boolean;
  payment_authorization_satisfied: boolean;
  card_on_file: boolean;
  qb_customer_id: string | null;
  qb_stored_payment_method_id: string | null;
  is_eligible: boolean;
  portal_blockers: PortalBlockerCode[] | string;
  primary_portal_blocker: string | null;
  verification_invoice_id: string | null;
  verification_invoice_sent_at: Date | string | null;
  verification_invoice_paid_at: Date | string | null;
  eligibility_last_computed_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface UpsertReadinessParams {
  client_id: string;
  contract_signed: boolean;
  deposit_paid: boolean;
  billing_path: BillingPath;
  payment_authorization_required: boolean;
  payment_authorization_satisfied: boolean;
  card_on_file: boolean;
  qb_customer_id?: string | null;
  qb_stored_payment_method_id?: string | null;
  is_eligible: boolean;
  portal_blockers: PortalBlockerCode[];
  primary_portal_blocker: PortalBlockerCode | null;
  verification_invoice_id?: string | null;
  verification_invoice_sent_at?: Date | string | null;
  verification_invoice_paid_at?: Date | string | null;
}

function parseBlockers(value: unknown): PortalBlockerCode[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is PortalBlockerCode => typeof item === 'string');
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function toIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  const trimmed = String(value).trim();
  return trimmed || null;
}

export function mapReadinessRow(row: ClientOnboardingReadinessRow): PortalEligibilitySnapshot {
  const billing_path = (row.billing_path || 'unknown') as BillingPath;
  return {
    contract_signed: row.contract_signed,
    deposit_paid: row.deposit_paid,
    billing_path,
    is_eligible: row.is_eligible,
    portal_blockers: parseBlockers(row.portal_blockers),
    primary_portal_blocker: (row.primary_portal_blocker as PortalBlockerCode | null) ?? null,
    payment_authorization_required: row.payment_authorization_required,
    payment_authorization_satisfied: row.payment_authorization_satisfied,
    card_on_file: row.card_on_file,
    qb_customer_id: row.qb_customer_id ?? null,
    qb_stored_payment_method_id: row.qb_stored_payment_method_id ?? null,
    verification_invoice_id: row.verification_invoice_id ?? null,
    verification_invoice_sent_at: toIso(row.verification_invoice_sent_at),
    verification_invoice_paid_at: toIso(row.verification_invoice_paid_at),
    allowed_actions: {
      can_invite_to_portal: row.is_eligible,
      can_send_verification_invoice:
        row.payment_authorization_required &&
        row.primary_portal_blocker === 'missing_card_on_file',
      can_mark_contract_signed: !row.contract_signed,
      can_mark_deposit_paid: row.contract_signed && !row.deposit_paid,
    },
  };
}

export class CloudSqlClientOnboardingReadinessRepository {
  async getByClientId(clientId: string): Promise<ClientOnboardingReadinessRow | null> {
    const { rows } = await getPool().query<ClientOnboardingReadinessRow>(
      `SELECT *
       FROM public.client_onboarding_readiness
       WHERE client_id = $1::uuid
       LIMIT 1`,
      [clientId]
    );
    return rows[0] ?? null;
  }

  async getByClientIds(clientIds: string[]): Promise<Map<string, ClientOnboardingReadinessRow>> {
    if (!clientIds.length) {
      return new Map();
    }

    const { rows } = await getPool().query<ClientOnboardingReadinessRow>(
      `SELECT *
       FROM public.client_onboarding_readiness
       WHERE client_id = ANY($1::uuid[])`,
      [clientIds]
    );

    const map = new Map<string, ClientOnboardingReadinessRow>();
    for (const row of rows) {
      map.set(row.client_id, row);
    }
    return map;
  }

  async getByVerificationInvoiceId(qboInvoiceId: string): Promise<ClientOnboardingReadinessRow | null> {
    const { rows } = await getPool().query<ClientOnboardingReadinessRow>(
      `SELECT *
       FROM public.client_onboarding_readiness
       WHERE verification_invoice_id = $1
       LIMIT 1`,
      [qboInvoiceId]
    );
    return rows[0] ?? null;
  }

  async upsert(params: UpsertReadinessParams): Promise<ClientOnboardingReadinessRow> {
    const { rows } = await getPool().query<ClientOnboardingReadinessRow>(
      `
      INSERT INTO public.client_onboarding_readiness (
        client_id,
        contract_signed,
        deposit_paid,
        billing_path,
        payment_authorization_required,
        payment_authorization_satisfied,
        card_on_file,
        qb_customer_id,
        qb_stored_payment_method_id,
        is_eligible,
        portal_blockers,
        primary_portal_blocker,
        verification_invoice_id,
        verification_invoice_sent_at,
        verification_invoice_paid_at,
        eligibility_last_computed_at
      )
      VALUES (
        $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11::jsonb, $12, $13, $14, $15, NOW()
      )
      ON CONFLICT (client_id)
      DO UPDATE SET
        contract_signed = EXCLUDED.contract_signed,
        deposit_paid = EXCLUDED.deposit_paid,
        billing_path = EXCLUDED.billing_path,
        payment_authorization_required = EXCLUDED.payment_authorization_required,
        payment_authorization_satisfied = EXCLUDED.payment_authorization_satisfied,
        card_on_file = EXCLUDED.card_on_file,
        qb_customer_id = COALESCE(EXCLUDED.qb_customer_id, client_onboarding_readiness.qb_customer_id),
        qb_stored_payment_method_id = COALESCE(
          EXCLUDED.qb_stored_payment_method_id,
          client_onboarding_readiness.qb_stored_payment_method_id
        ),
        is_eligible = EXCLUDED.is_eligible,
        portal_blockers = EXCLUDED.portal_blockers,
        primary_portal_blocker = EXCLUDED.primary_portal_blocker,
        verification_invoice_id = COALESCE(
          EXCLUDED.verification_invoice_id,
          client_onboarding_readiness.verification_invoice_id
        ),
        verification_invoice_sent_at = COALESCE(
          EXCLUDED.verification_invoice_sent_at,
          client_onboarding_readiness.verification_invoice_sent_at
        ),
        verification_invoice_paid_at = COALESCE(
          EXCLUDED.verification_invoice_paid_at,
          client_onboarding_readiness.verification_invoice_paid_at
        ),
        eligibility_last_computed_at = NOW(),
        updated_at = NOW()
      RETURNING *
      `,
      [
        params.client_id,
        params.contract_signed,
        params.deposit_paid,
        params.billing_path,
        params.payment_authorization_required,
        params.payment_authorization_satisfied,
        params.card_on_file,
        params.qb_customer_id ?? null,
        params.qb_stored_payment_method_id ?? null,
        params.is_eligible,
        JSON.stringify(params.portal_blockers),
        params.primary_portal_blocker,
        params.verification_invoice_id ?? null,
        params.verification_invoice_sent_at ?? null,
        params.verification_invoice_paid_at ?? null,
      ]
    );

    const row = rows[0];
    if (!row) {
      throw new Error('Failed to upsert client onboarding readiness');
    }
    return row;
  }

  async recordEvent(input: {
    client_id: string;
    event_type: OnboardingEventType;
    event_source?: string;
    payload?: Record<string, unknown>;
  }): Promise<void> {
    await getPool().query(
      `
      INSERT INTO public.client_onboarding_events (client_id, event_type, event_source, payload)
      VALUES ($1::uuid, $2, $3, $4::jsonb)
      `,
      [
        input.client_id,
        input.event_type,
        input.event_source ?? 'system',
        JSON.stringify(input.payload ?? {}),
      ]
    );
  }
}

export const clientOnboardingReadinessRepository =
  new CloudSqlClientOnboardingReadinessRepository();
