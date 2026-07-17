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
    normalized.includes('full support')
  ) {
    return 'full_support';
  }

  if (
    normalized.includes('self-pay') ||
    normalized.includes('self pay') ||
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
  if (!input.deposit_paid) {
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
