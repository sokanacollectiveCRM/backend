/**
 * Pure portal eligibility rules. No Express, database, or vendor SDK imports.
 * Persistence stays in PortalEligibilityService until the next slice.
 */

export const PORTAL_BLOCKER_CODES = [
  'contract_unsigned',
  'deposit_unpaid',
  'missing_card_on_file',
  'payment_authorization_required',
  'billing_path_unknown',
] as const;

export type PortalBlockerCode = (typeof PORTAL_BLOCKER_CODES)[number];

export const PORTAL_BLOCKER_PRIORITY: PortalBlockerCode[] = [
  'billing_path_unknown',
  'contract_unsigned',
  'deposit_unpaid',
  'missing_card_on_file',
  'payment_authorization_required',
];

export const BILLING_PATHS = [
  'insurance',
  'self_pay',
  'medicaid',
  'full_support',
  'unknown',
] as const;

export type BillingPath = (typeof BILLING_PATHS)[number];

export const ONBOARDING_EVENT_TYPES = [
  'contract_signed',
  'deposit_paid',
  'quickbooks_card_missing',
  /** @deprecated Historical audit compatibility only. */
  'verification_invoice_sent',
  /** @deprecated Historical audit compatibility only. */
  'verification_invoice_paid',
  'installment_invoice_generated',
  'installment_invoice_email_failed',
  'card_on_file_confirmed',
  'portal_locked',
  'portal_unlocked',
  'portal_eligibility_computed',
  /** @deprecated Historical audit compatibility only. */
  'verification_invoice_paid_no_stored_method',
] as const;

export type OnboardingEventType = (typeof ONBOARDING_EVENT_TYPES)[number];

export interface PortalAllowedActions {
  can_invite_to_portal: boolean;
  can_mark_contract_signed: boolean;
  can_mark_deposit_paid: boolean;
}

export interface PortalEligibilitySnapshot {
  is_eligible: boolean;
  portal_blockers: PortalBlockerCode[];
  primary_portal_blocker: PortalBlockerCode | null;
  billing_path: BillingPath;
  payment_authorization_required: boolean;
  payment_authorization_satisfied: boolean;
  card_on_file: boolean;
  qb_customer_id: string | null;
  qb_stored_payment_method_id: string | null;
  verification_invoice_id: string | null;
  verification_invoice_sent_at: string | null;
  verification_invoice_paid_at: string | null;
  contract_signed: boolean;
  deposit_paid: boolean;
  allowed_actions: PortalAllowedActions;
}

export function resolveBillingPath(
  paymentMethod: string | null | undefined
): BillingPath {
  const normalized = String(paymentMethod || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

  if (!normalized) {
    return 'unknown';
  }

  if (normalized.includes('medicaid')) {
    return 'medicaid';
  }

  if (
    normalized.includes('unable to pay') ||
    normalized.includes('full support') ||
    normalized.includes('no payment') ||
    normalized.includes('no client payment') ||
    normalized.includes('payment waived') ||
    normalized.includes('complimentary')
  ) {
    return 'full_support';
  }

  if (
    normalized.includes('self-pay') ||
    normalized.includes('self pay') ||
    normalized.includes('out of pocket') ||
    normalized === 'self_pay'
  ) {
    return 'self_pay';
  }

  if (
    normalized.includes('insurance') ||
    normalized.includes('commercial') ||
    normalized.includes('private insurance')
  ) {
    return 'insurance';
  }

  return 'unknown';
}

export function isPaymentAuthorizationRequired(
  billingPath: BillingPath
): boolean {
  return billingPath === 'insurance' || billingPath === 'self_pay';
}

/** Only self-pay clients receive client-facing deposit invoices. */
export function isClientDepositRequired(billingPath: BillingPath): boolean {
  return billingPath === 'self_pay';
}

export interface ComputePortalEligibilityInput {
  contract_signed: boolean;
  deposit_paid: boolean;
  billing_path: BillingPath;
  card_on_file: boolean;
}

export function computePortalBlockers(
  input: ComputePortalEligibilityInput
): PortalBlockerCode[] {
  const blockers: PortalBlockerCode[] = [];

  if (input.billing_path === 'unknown') {
    blockers.push('billing_path_unknown');
  }
  if (!input.contract_signed) {
    blockers.push('contract_unsigned');
  }
  if (isClientDepositRequired(input.billing_path) && !input.deposit_paid) {
    blockers.push('deposit_unpaid');
  }

  const paymentAuthorizationRequired = isPaymentAuthorizationRequired(
    input.billing_path
  );
  if (paymentAuthorizationRequired && !input.card_on_file) {
    blockers.push('missing_card_on_file');
  }

  return blockers;
}

export function selectPrimaryPortalBlocker(
  blockers: PortalBlockerCode[]
): PortalBlockerCode | null {
  for (const code of PORTAL_BLOCKER_PRIORITY) {
    if (blockers.includes(code)) {
      return code;
    }
  }
  return null;
}

export function computePortalEligibility(
  input: ComputePortalEligibilityInput
): Omit<
  PortalEligibilitySnapshot,
  | 'qb_customer_id'
  | 'qb_stored_payment_method_id'
  | 'verification_invoice_id'
  | 'verification_invoice_sent_at'
  | 'verification_invoice_paid_at'
  | 'allowed_actions'
> {
  const portal_blockers = computePortalBlockers(input);
  const payment_authorization_required = isPaymentAuthorizationRequired(
    input.billing_path
  );
  const payment_authorization_satisfied =
    !payment_authorization_required || input.card_on_file;

  return {
    contract_signed: input.contract_signed,
    deposit_paid: input.deposit_paid,
    billing_path: input.billing_path,
    portal_blockers,
    primary_portal_blocker: selectPrimaryPortalBlocker(portal_blockers),
    is_eligible: portal_blockers.length === 0,
    payment_authorization_required,
    payment_authorization_satisfied,
    card_on_file: input.card_on_file,
  };
}

export function computeAllowedActions(
  snapshot: Pick<
    PortalEligibilitySnapshot,
    | 'is_eligible'
    | 'contract_signed'
    | 'deposit_paid'
    | 'primary_portal_blocker'
    | 'payment_authorization_required'
  >
): PortalAllowedActions {
  return {
    can_invite_to_portal: snapshot.is_eligible,
    can_mark_contract_signed: !snapshot.contract_signed,
    can_mark_deposit_paid: snapshot.contract_signed && !snapshot.deposit_paid,
  };
}

/** Contract row status that counts as signed for portal eligibility. */
export const SIGNED_CONTRACT_STATUS = 'signed';

/** Installment payment_type that counts as the client deposit. */
export const DEPOSIT_PAYMENT_TYPE = 'deposit';

/** Installment statuses that count as a paid client deposit. */
export const PAID_INSTALLMENT_STATUSES = [
  'paid',
  'succeeded',
  'completed',
] as const;

export type PaidInstallmentStatus = (typeof PAID_INSTALLMENT_STATUSES)[number];

export function isPaidInstallmentStatus(
  status: string | null | undefined
): boolean {
  const normalized = String(status || '')
    .trim()
    .toLowerCase();
  return (PAID_INSTALLMENT_STATUSES as readonly string[]).includes(normalized);
}

/**
 * Deposit is paid when a deposit installment is paid. A legacy `payments` row
 * counts only when the installment fact is absent. A present `false` does not
 * fall through, matching SQL `COALESCE(installment, legacy, false)`.
 */
export function resolveDepositPaid(input: {
  installmentDepositPaid: boolean | null | undefined;
  legacyPaymentExists: boolean | null | undefined;
}): boolean {
  if (input.installmentDepositPaid != null) {
    return input.installmentDepositPaid;
  }
  if (input.legacyPaymentExists != null) {
    return input.legacyPaymentExists;
  }
  return false;
}

/** An explicit force flag wins. `undefined` keeps the resolved fact. */
export function applyFactOverride(
  resolved: boolean,
  force: boolean | undefined
): boolean {
  if (force !== undefined) {
    return force;
  }
  return resolved;
}

export function resolveContractSigned(
  hasSignedContract: boolean | null | undefined,
  forceContractSigned?: boolean
): boolean {
  return applyFactOverride(Boolean(hasSignedContract), forceContractSigned);
}

export interface OnboardingFactInput {
  hasSignedContract: boolean | null | undefined;
  installmentDepositPaid: boolean | null | undefined;
  legacyPaymentExists: boolean | null | undefined;
  paymentMethod: string | null | undefined;
  forceContractSigned?: boolean;
  forceDepositPaid?: boolean;
}

export interface OnboardingFacts {
  contract_signed: boolean;
  deposit_paid: boolean;
  billing_path: BillingPath;
  payment_method: string | null;
}

export function resolveOnboardingFacts(
  input: OnboardingFactInput
): OnboardingFacts {
  const payment_method = input.paymentMethod ?? null;
  const deposit_paid = applyFactOverride(
    resolveDepositPaid(input),
    input.forceDepositPaid
  );

  return {
    contract_signed: resolveContractSigned(
      input.hasSignedContract,
      input.forceContractSigned
    ),
    deposit_paid,
    billing_path: resolveBillingPath(payment_method),
    payment_method,
  };
}

/** Fields from a stored-method lookup that eligibility is allowed to use. */
export function resolveCardOnFileFact(input: {
  onFile: boolean;
  paymentMethodReference: string | null | undefined;
}): {
  card_on_file: boolean;
  qb_stored_payment_method_id: string | null;
} {
  return {
    card_on_file: input.onFile === true,
    qb_stored_payment_method_id: input.paymentMethodReference ?? null,
  };
}

export const INVITE_BLOCKED_FALLBACK_MESSAGE =
  'Invite available after contract is signed, deposit is paid, and billing readiness is satisfied.';

export function inviteBlockerMessage(
  blocker: PortalBlockerCode | null,
  billingPath: BillingPath
): string {
  switch (blocker) {
    case 'contract_unsigned':
      return isClientDepositRequired(billingPath)
        ? 'Invite available after contract is signed and deposit is paid.'
        : 'Invite available after contract is signed and billing readiness is satisfied.';
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

/**
 * List views with no saved readiness row. This is the cached-miss policy:
 * it does not recompute live gates or add `contract_unsigned`.
 */
export function readinessNotYetComputedSnapshot(): PortalEligibilitySnapshot {
  return {
    contract_signed: false,
    deposit_paid: false,
    billing_path: 'unknown',
    is_eligible: false,
    portal_blockers: ['billing_path_unknown'],
    primary_portal_blocker: 'billing_path_unknown',
    payment_authorization_required: false,
    payment_authorization_satisfied: false,
    card_on_file: false,
    qb_customer_id: null,
    qb_stored_payment_method_id: null,
    verification_invoice_id: null,
    verification_invoice_sent_at: null,
    verification_invoice_paid_at: null,
    allowed_actions: {
      can_invite_to_portal: false,
      can_mark_contract_signed: true,
      can_mark_deposit_paid: false,
    },
  };
}

export type PortalEligibilityTransition = 'unlocked' | 'locked' | 'unchanged';

export function portalEligibilityTransition(
  previousEligible: boolean,
  nextEligible: boolean
): PortalEligibilityTransition {
  if (!previousEligible && nextEligible) {
    return 'unlocked';
  }
  if (previousEligible && !nextEligible) {
    return 'locked';
  }
  return 'unchanged';
}
