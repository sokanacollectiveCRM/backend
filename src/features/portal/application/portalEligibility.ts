import {
  BillingPath,
  PortalEligibilitySnapshot,
  applyFactOverride,
  computePortalEligibility,
  inviteBlockerMessage,
  portalEligibilityTransition,
  readinessNotYetComputedSnapshot,
  resolveCardOnFileFact,
  resolveOnboardingFacts,
} from '../domain/eligibility';
import { PortalEligibilityDeps } from './ports';

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

export interface ComputeAndPersistOptions {
  verification_invoice_id?: string | null;
  verification_invoice_sent_at?: Date | string | null;
  verification_invoice_paid_at?: Date | string | null;
  force_deposit_paid?: boolean;
  force_contract_signed?: boolean;
  event_source?: string;
}

const DEFAULT_EVENT_SOURCE = 'portal_eligibility_service';

export async function loadOnboardingGates(
  deps: Pick<PortalEligibilityDeps, 'facts'>,
  clientId: string
): Promise<OnboardingGateSnapshot> {
  const record = await deps.facts.read(clientId);
  const facts = resolveOnboardingFacts({
    hasSignedContract: record?.hasSignedContract,
    installmentDepositPaid: record?.installmentDepositPaid,
    legacyPaymentExists: record?.legacyPaymentExists,
    paymentMethod: record?.paymentMethod,
  });
  return {
    contract_signed: facts.contract_signed,
    deposit_paid: facts.deposit_paid,
    billing_path: facts.billing_path,
    qb_customer_id: record?.qbCustomerId ?? null,
    payment_method: facts.payment_method,
  };
}

export async function computeAndPersistPortalEligibility(
  deps: PortalEligibilityDeps,
  clientId: string,
  options?: ComputeAndPersistOptions
): Promise<PortalEligibilitySnapshot> {
  const existing = await deps.readiness.getStored(clientId);
  const gates = await loadOnboardingGates(deps, clientId);
  const cardRecord = await deps.cards.read(clientId);
  const cardState = resolveCardOnFileFact(cardRecord);

  const contract_signed = applyFactOverride(
    gates.contract_signed,
    options?.force_contract_signed
  );
  const deposit_paid = applyFactOverride(
    gates.deposit_paid,
    options?.force_deposit_paid
  );

  const computed = computePortalEligibility({
    contract_signed,
    deposit_paid,
    billing_path: gates.billing_path,
    card_on_file: cardState.card_on_file,
  });

  const snapshot = await deps.readiness.save({
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

  const event_source = options?.event_source ?? DEFAULT_EVENT_SOURCE;
  const transition = portalEligibilityTransition(
    existing?.is_eligible ?? false,
    snapshot.is_eligible
  );

  await deps.readiness.recordEvent({
    client_id: clientId,
    event_type: 'portal_eligibility_computed',
    event_source,
    payload: {
      is_eligible: snapshot.is_eligible,
      portal_blockers: snapshot.portal_blockers,
      primary_portal_blocker: snapshot.primary_portal_blocker,
    },
  });

  if (transition === 'unlocked') {
    await deps.readiness.recordEvent({
      client_id: clientId,
      event_type: 'portal_unlocked',
      event_source,
    });
  } else if (transition === 'locked') {
    await deps.readiness.recordEvent({
      client_id: clientId,
      event_type: 'portal_locked',
      event_source,
      payload: {
        primary_portal_blocker: snapshot.primary_portal_blocker,
      },
    });
  }

  return snapshot;
}

/**
 * List views read cached readiness only. No per-client recompute or
 * QuickBooks card checks; those run on invite and detail paths.
 */
export async function getCachedPortalEligibilityBatch(
  deps: Pick<PortalEligibilityDeps, 'readiness'>,
  clientIds: string[]
): Promise<Map<string, PortalEligibilitySnapshot>> {
  const uniqueIds = [...new Set(clientIds.filter(Boolean))];
  const map = new Map<string, PortalEligibilitySnapshot>();
  if (!uniqueIds.length) return map;

  const stored = await deps.readiness.getSnapshots(uniqueIds);
  for (const clientId of uniqueIds) {
    map.set(
      clientId,
      stored.get(clientId) ?? readinessNotYetComputedSnapshot()
    );
  }
  return map;
}

export async function checkInviteEligibility(
  deps: PortalEligibilityDeps,
  clientId: string
): Promise<InviteEligibility> {
  try {
    const snapshot = await computeAndPersistPortalEligibility(deps, clientId);
    if (!snapshot.is_eligible) {
      return {
        eligible: false,
        reason: inviteBlockerMessage(
          snapshot.primary_portal_blocker,
          snapshot.billing_path
        ),
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
