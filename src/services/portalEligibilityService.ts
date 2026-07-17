import {
  BillingPath,
  PortalEligibilitySnapshot,
  computeAllowedActions,
  computePortalEligibility,
  resolveBillingPath,
} from '../constants/portalEligibility';
import { getPool } from '../db/cloudSqlPool';
import {
  clientOnboardingReadinessRepository,
  mapReadinessRow,
} from '../repositories/cloudSqlClientOnboardingReadinessRepository';
import { customerPaymentMethodService } from './payments/customerPaymentMethodService';

export interface InviteEligibility {
  eligible: boolean;
  reason?: string;
  contractSignedAt?: Date;
  firstPaymentPaidAt?: Date;
  snapshot?: PortalEligibilitySnapshot;
}

export interface OnboardingGateSnapshot {
  contract_signed: boolean;
  deposit_paid: boolean;
  billing_path: BillingPath;
  qb_customer_id: string | null;
  payment_method: string | null;
}

const PAID_INSTALLMENT_STATUSES = new Set(['paid', 'succeeded', 'completed']);

export class PortalEligibilityService {
  async getOnboardingGates(clientId: string): Promise<OnboardingGateSnapshot> {
    const { rows } = await getPool().query<{
      payment_method: string | null;
      qbo_customer_id: string | null;
      contract_signed: boolean | null;
      deposit_paid: boolean | null;
    }>(
      `
      WITH client_row AS (
        SELECT payment_method, qbo_customer_id
        FROM public.phi_clients
        WHERE id = $1::uuid
        LIMIT 1
      ),
      signed_contract AS (
        SELECT EXISTS (
          SELECT 1
          FROM public.phi_contracts
          WHERE client_id = $1::uuid
            AND status = 'signed'
        ) AS contract_signed
      ),
      deposit_installment AS (
        SELECT EXISTS (
          SELECT 1
          FROM public.payment_installments pi
          JOIN public.payment_schedules ps ON ps.id = pi.schedule_id
          JOIN public.phi_contracts pc ON pc.id = ps.contract_id
          WHERE pc.client_id = $1::uuid
            AND COALESCE(pi.payment_type, '') = 'deposit'
            AND LOWER(COALESCE(pi.status, '')) = ANY($2::text[])
        ) AS deposit_paid
      ),
      legacy_payment AS (
        SELECT EXISTS (
          SELECT 1
          FROM public.payments
          WHERE client_id = $1::uuid
        ) AS deposit_paid
      )
      SELECT
        cr.payment_method,
        cr.qbo_customer_id,
        sc.contract_signed,
        COALESCE(di.deposit_paid, lp.deposit_paid, FALSE) AS deposit_paid
      FROM client_row cr
      CROSS JOIN signed_contract sc
      CROSS JOIN deposit_installment di
      CROSS JOIN legacy_payment lp
      `,
      [clientId, Array.from(PAID_INSTALLMENT_STATUSES)]
    );

    const row = rows[0];
    const payment_method = row?.payment_method ?? null;
    return {
      contract_signed: Boolean(row?.contract_signed),
      deposit_paid: Boolean(row?.deposit_paid),
      billing_path: resolveBillingPath(payment_method),
      qb_customer_id: row?.qbo_customer_id ?? null,
      payment_method,
    };
  }

  async computeAndPersist(
    clientId: string,
    options?: {
      verification_invoice_id?: string | null;
      verification_invoice_sent_at?: Date | string | null;
      verification_invoice_paid_at?: Date | string | null;
      force_deposit_paid?: boolean;
      force_contract_signed?: boolean;
      event_source?: string;
    }
  ): Promise<PortalEligibilitySnapshot> {
    const existing =
      await clientOnboardingReadinessRepository.getByClientId(clientId);
    const gates = await this.getOnboardingGates(clientId);
    const normalizedCard =
      await customerPaymentMethodService.getCardOnFileStatus(clientId);
    const cardState = {
      card_on_file: normalizedCard.on_file,
      qb_stored_payment_method_id: normalizedCard.payment_method_reference,
    };

    const contract_signed =
      options?.force_contract_signed ?? gates.contract_signed;
    const deposit_paid = options?.force_deposit_paid ?? gates.deposit_paid;

    const computed = computePortalEligibility({
      contract_signed,
      deposit_paid,
      billing_path: gates.billing_path,
      card_on_file: cardState.card_on_file,
    });

    const row = await clientOnboardingReadinessRepository.upsert({
      client_id: clientId,
      contract_signed,
      deposit_paid,
      billing_path: gates.billing_path,
      payment_authorization_required: computed.payment_authorization_required,
      payment_authorization_satisfied: computed.payment_authorization_satisfied,
      card_on_file: computed.card_on_file,
      qb_customer_id: gates.qb_customer_id,
      qb_stored_payment_method_id: cardState.qb_stored_payment_method_id,
      is_eligible: computed.is_eligible,
      portal_blockers: computed.portal_blockers,
      primary_portal_blocker: computed.primary_portal_blocker,
      verification_invoice_id:
        options?.verification_invoice_id ??
        existing?.verification_invoice_id ??
        null,
      verification_invoice_sent_at:
        options?.verification_invoice_sent_at ??
        existing?.verification_invoice_sent_at ??
        null,
      verification_invoice_paid_at:
        options?.verification_invoice_paid_at ??
        existing?.verification_invoice_paid_at ??
        null,
    });

    const previousEligible = existing?.is_eligible ?? false;
    const snapshot = mapReadinessRow(row);
    snapshot.allowed_actions = computeAllowedActions(snapshot);

    await clientOnboardingReadinessRepository.recordEvent({
      client_id: clientId,
      event_type: 'portal_eligibility_computed',
      event_source: options?.event_source ?? 'portal_eligibility_service',
      payload: {
        is_eligible: snapshot.is_eligible,
        portal_blockers: snapshot.portal_blockers,
        primary_portal_blocker: snapshot.primary_portal_blocker,
      },
    });

    if (!previousEligible && snapshot.is_eligible) {
      await clientOnboardingReadinessRepository.recordEvent({
        client_id: clientId,
        event_type: 'portal_unlocked',
        event_source: options?.event_source ?? 'portal_eligibility_service',
      });
    } else if (previousEligible && !snapshot.is_eligible) {
      await clientOnboardingReadinessRepository.recordEvent({
        client_id: clientId,
        event_type: 'portal_locked',
        event_source: options?.event_source ?? 'portal_eligibility_service',
        payload: {
          primary_portal_blocker: snapshot.primary_portal_blocker,
        },
      });
    }

    return snapshot;
  }

  async getPortalEligibility(
    clientId: string
  ): Promise<PortalEligibilitySnapshot> {
    return this.computeAndPersist(clientId);
  }

  async getPortalEligibilityBatch(
    clientIds: string[]
  ): Promise<Map<string, PortalEligibilitySnapshot>> {
    const uniqueIds = [...new Set(clientIds.filter(Boolean))];
    const map = new Map<string, PortalEligibilitySnapshot>();

    await Promise.all(
      uniqueIds.map(async (clientId) => {
        try {
          const snapshot = await this.computeAndPersist(clientId);
          map.set(clientId, snapshot);
        } catch {
          // Skip clients that fail readiness computation in list views.
        }
      })
    );

    return map;
  }

  async getInviteEligibility(clientId: string): Promise<InviteEligibility> {
    try {
      const snapshot = await this.computeAndPersist(clientId);
      if (!snapshot.is_eligible) {
        return {
          eligible: false,
          reason: this.blockerMessage(snapshot.primary_portal_blocker),
          snapshot,
        };
      }

      return {
        eligible: true,
        snapshot,
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to check invite eligibility';
      throw new Error(`Failed to check invite eligibility: ${message}`);
    }
  }

  private blockerMessage(
    blocker: PortalEligibilitySnapshot['primary_portal_blocker']
  ): string {
    switch (blocker) {
      case 'contract_unsigned':
        return 'Invite available after contract is signed and deposit is paid.';
      case 'deposit_unpaid':
        return 'Invite available after contract is signed and deposit is paid.';
      case 'missing_card_on_file':
        return 'Invite available after a QuickBooks payment method is saved on file.';
      case 'billing_path_unknown':
        return 'Invite unavailable until billing path is configured.';
      default:
        return 'Invite available after onboarding and billing readiness requirements are satisfied.';
    }
  }
}

export const portalEligibilityService = new PortalEligibilityService();
