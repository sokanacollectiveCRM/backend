import { PortalEligibilitySnapshot } from '../constants/portalEligibility';

export function mergePortalEligibilityFields<T extends Record<string, unknown>>(
  target: T,
  snapshot?: PortalEligibilitySnapshot | null
): T & Partial<PortalEligibilitySnapshot> {
  if (!snapshot) {
    return target;
  }

  return {
    ...target,
    is_eligible: snapshot.is_eligible,
    portal_blockers: snapshot.portal_blockers,
    primary_portal_blocker: snapshot.primary_portal_blocker,
    billing_path: snapshot.billing_path,
    payment_authorization_required: snapshot.payment_authorization_required,
    payment_authorization_satisfied: snapshot.payment_authorization_satisfied,
    card_on_file: snapshot.card_on_file,
    qb_customer_id: snapshot.qb_customer_id ?? (target.qb_customer_id as string | null | undefined) ?? null,
    qbo_customer_id:
      snapshot.qb_customer_id ??
      (target.qbo_customer_id as string | null | undefined) ??
      (target.qb_customer_id as string | null | undefined) ??
      null,
    qb_stored_payment_method_id: snapshot.qb_stored_payment_method_id,
    verification_invoice_id: snapshot.verification_invoice_id,
    verification_invoice_sent_at: snapshot.verification_invoice_sent_at,
    verification_invoice_paid_at: snapshot.verification_invoice_paid_at,
    allowed_actions: snapshot.allowed_actions,
    contract_signed: snapshot.contract_signed,
    deposit_paid: snapshot.deposit_paid,
  };
}
