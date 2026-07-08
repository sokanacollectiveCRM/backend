import {
  computePortalBlockers,
  computePortalEligibility,
  computeAllowedActions,
  isPaymentAuthorizationRequired,
  resolveBillingPath,
  selectPrimaryPortalBlocker,
} from '../constants/portalEligibility';

describe('portal eligibility computation', () => {
  describe('resolveBillingPath', () => {
    it('maps insurance payment methods', () => {
      expect(resolveBillingPath('Commercial Insurance')).toBe('insurance');
      expect(resolveBillingPath('Private Insurance')).toBe('insurance');
    });

    it('maps self pay', () => {
      expect(resolveBillingPath('Self-Pay')).toBe('self_pay');
    });

    it('maps medicaid and full support', () => {
      expect(resolveBillingPath('Medicaid')).toBe('medicaid');
      expect(resolveBillingPath('I am unable to pay / Full Support Option')).toBe('full_support');
    });

    it('returns unknown for empty values', () => {
      expect(resolveBillingPath(null)).toBe('unknown');
    });
  });

  describe('payment authorization requirements', () => {
    it('requires authorization for insurance and self pay', () => {
      expect(isPaymentAuthorizationRequired('insurance')).toBe(true);
      expect(isPaymentAuthorizationRequired('self_pay')).toBe(true);
    });

    it('does not require authorization for medicaid or full support', () => {
      expect(isPaymentAuthorizationRequired('medicaid')).toBe(false);
      expect(isPaymentAuthorizationRequired('full_support')).toBe(false);
    });
  });

  describe('blocker generation', () => {
    it('flags unsigned contract and unpaid deposit', () => {
      const blockers = computePortalBlockers({
        contract_signed: false,
        deposit_paid: false,
        billing_path: 'self_pay',
        card_on_file: false,
      });
      expect(blockers).toEqual(
        expect.arrayContaining(['contract_unsigned', 'deposit_unpaid', 'missing_card_on_file'])
      );
    });

    it('flags missing card for insurance/self pay only', () => {
      const insuranceBlockers = computePortalBlockers({
        contract_signed: true,
        deposit_paid: true,
        billing_path: 'insurance',
        card_on_file: false,
      });
      expect(insuranceBlockers).toEqual(['missing_card_on_file']);

      const medicaidBlockers = computePortalBlockers({
        contract_signed: true,
        deposit_paid: true,
        billing_path: 'medicaid',
        card_on_file: false,
      });
      expect(medicaidBlockers).toEqual([]);
    });

    it('selects highest priority blocker', () => {
      const blockers = computePortalBlockers({
        contract_signed: false,
        deposit_paid: false,
        billing_path: 'unknown',
        card_on_file: false,
      });
      expect(selectPrimaryPortalBlocker(blockers)).toBe('billing_path_unknown');
    });
  });

  describe('eligibility outcomes', () => {
    it('is not eligible without signed contract', () => {
      const result = computePortalEligibility({
        contract_signed: false,
        deposit_paid: true,
        billing_path: 'medicaid',
        card_on_file: false,
      });
      expect(result.is_eligible).toBe(false);
      expect(result.portal_blockers).toContain('contract_unsigned');
    });

    it('is not eligible with signed contract but unpaid deposit', () => {
      const result = computePortalEligibility({
        contract_signed: true,
        deposit_paid: false,
        billing_path: 'medicaid',
        card_on_file: false,
      });
      expect(result.is_eligible).toBe(false);
      expect(result.primary_portal_blocker).toBe('deposit_unpaid');
    });

    it('allows medicaid/full support without stored card', () => {
      expect(
        computePortalEligibility({
          contract_signed: true,
          deposit_paid: true,
          billing_path: 'medicaid',
          card_on_file: false,
        }).is_eligible
      ).toBe(true);

      expect(
        computePortalEligibility({
          contract_signed: true,
          deposit_paid: true,
          billing_path: 'full_support',
          card_on_file: false,
        }).is_eligible
      ).toBe(true);
    });

    it('blocks insurance/self pay without card and allows with card', () => {
      const blocked = computePortalEligibility({
        contract_signed: true,
        deposit_paid: true,
        billing_path: 'insurance',
        card_on_file: false,
      });
      expect(blocked.is_eligible).toBe(false);
      expect(blocked.primary_portal_blocker).toBe('missing_card_on_file');

      const eligible = computePortalEligibility({
        contract_signed: true,
        deposit_paid: true,
        billing_path: 'self_pay',
        card_on_file: true,
      });
      expect(eligible.is_eligible).toBe(true);
      expect(eligible.payment_authorization_satisfied).toBe(true);
    });
  });

  describe('allowed actions', () => {
    it('allows verification invoice only when missing card blocker applies', () => {
      const actions = computeAllowedActions({
        is_eligible: false,
        contract_signed: true,
        deposit_paid: true,
        primary_portal_blocker: 'missing_card_on_file',
        payment_authorization_required: true,
      });
      expect(actions.can_send_verification_invoice).toBe(true);
      expect(actions.can_invite_to_portal).toBe(false);
    });
  });
});
