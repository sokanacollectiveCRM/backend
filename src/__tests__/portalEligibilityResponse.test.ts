import { mergePortalEligibilityFields } from '../utils/portalEligibilityResponse';

describe('portal eligibility API response shape', () => {
  it('merges readiness fields onto client payloads', () => {
    const merged = mergePortalEligibilityFields(
      {
        id: 'client-1',
        first_name: 'Jane',
        qbo_customer_id: 'legacy-qbo-id',
      },
      {
        is_eligible: false,
        portal_blockers: ['missing_card_on_file'],
        primary_portal_blocker: 'missing_card_on_file',
        billing_path: 'insurance',
        payment_authorization_required: true,
        payment_authorization_satisfied: false,
        card_on_file: false,
        qb_customer_id: 'qb-cust-1',
        qb_stored_payment_method_id: null,
        verification_invoice_id: 'inv-1',
        verification_invoice_sent_at: '2026-07-08T12:00:00.000Z',
        verification_invoice_paid_at: null,
        contract_signed: true,
        deposit_paid: true,
        allowed_actions: {
          can_invite_to_portal: false,
          can_send_verification_invoice: true,
          can_mark_contract_signed: false,
          can_mark_deposit_paid: false,
        },
      }
    );

    expect(merged).toEqual(
      expect.objectContaining({
        is_eligible: false,
        portal_blockers: ['missing_card_on_file'],
        primary_portal_blocker: 'missing_card_on_file',
        billing_path: 'insurance',
        payment_authorization_required: true,
        payment_authorization_satisfied: false,
        card_on_file: false,
        qb_customer_id: 'qb-cust-1',
        qbo_customer_id: 'qb-cust-1',
        verification_invoice_id: 'inv-1',
        allowed_actions: expect.objectContaining({
          can_send_verification_invoice: true,
        }),
      })
    );
  });
});
