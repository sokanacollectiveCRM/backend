import {
  applyFactOverride,
  computeAllowedActions,
  computePortalBlockers,
  computePortalEligibility,
  inviteBlockerMessage,
  isClientDepositRequired,
  isPaidInstallmentStatus,
  isPaymentAuthorizationRequired,
  portalEligibilityTransition,
  readinessNotYetComputedSnapshot,
  resolveBillingPath,
  resolveCardOnFileFact,
  resolveDepositPaid,
  resolveOnboardingFacts,
  selectPrimaryPortalBlocker,
} from '../features/portal';

describe('portal eligibility computation', () => {
  describe('resolveBillingPath', () => {
    it('maps insurance payment methods', () => {
      expect(resolveBillingPath('Commercial Insurance')).toBe('insurance');
      expect(resolveBillingPath('Private Insurance')).toBe('insurance');
    });

    it('maps self pay', () => {
      expect(resolveBillingPath('Self-Pay')).toBe('self_pay');
      expect(resolveBillingPath('Out of Pocket')).toBe('self_pay');
    });

    it('maps medicaid and full support', () => {
      expect(resolveBillingPath('Medicaid')).toBe('medicaid');
      expect(
        resolveBillingPath('I am unable to pay / Full Support Option')
      ).toBe('full_support');
      expect(resolveBillingPath('No Payment Required')).toBe('full_support');
      expect(resolveBillingPath('Payment Waived')).toBe('full_support');
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

    it('requires a client deposit only for self pay', () => {
      expect(isClientDepositRequired('self_pay')).toBe(true);
      expect(isClientDepositRequired('insurance')).toBe(false);
      expect(isClientDepositRequired('medicaid')).toBe(false);
      expect(isClientDepositRequired('full_support')).toBe(false);
      expect(isClientDepositRequired('unknown')).toBe(false);
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
        expect.arrayContaining([
          'contract_unsigned',
          'deposit_unpaid',
          'missing_card_on_file',
        ])
      );
    });

    it('flags missing card for insurance/self pay only', () => {
      const insuranceBlockers = computePortalBlockers({
        contract_signed: true,
        deposit_paid: false,
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

    it('does not require a client deposit for Medicaid', () => {
      const result = computePortalEligibility({
        contract_signed: true,
        deposit_paid: false,
        billing_path: 'medicaid',
        card_on_file: false,
      });
      expect(result.is_eligible).toBe(true);
      expect(result.primary_portal_blocker).toBeNull();
    });

    it('allows medicaid/full support without stored card', () => {
      expect(
        computePortalEligibility({
          contract_signed: true,
          deposit_paid: false,
          billing_path: 'medicaid',
          card_on_file: false,
        }).is_eligible
      ).toBe(true);

      expect(
        computePortalEligibility({
          contract_signed: true,
          deposit_paid: false,
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
    it('does not expose the deprecated verification-invoice action', () => {
      const actions = computeAllowedActions({
        is_eligible: false,
        contract_signed: true,
        deposit_paid: true,
        primary_portal_blocker: 'missing_card_on_file',
        payment_authorization_required: true,
      });
      expect(actions).not.toHaveProperty('can_send_verification_invoice');
      expect(actions.can_invite_to_portal).toBe(false);
    });
  });

  describe('onboarding facts', () => {
    it('treats a paid installment as deposit paid and ignores a missing legacy row', () => {
      expect(
        resolveDepositPaid({
          installmentDepositPaid: true,
          legacyPaymentExists: false,
        })
      ).toBe(true);
    });

    it('does not fall through to a legacy payment when the installment fact is false', () => {
      expect(
        resolveDepositPaid({
          installmentDepositPaid: false,
          legacyPaymentExists: true,
        })
      ).toBe(false);
    });

    it('uses a legacy payment only when the installment fact is absent', () => {
      expect(
        resolveDepositPaid({
          installmentDepositPaid: null,
          legacyPaymentExists: true,
        })
      ).toBe(true);
    });

    it('lets an explicit force flag override a resolved fact', () => {
      expect(applyFactOverride(false, true)).toBe(true);
      expect(applyFactOverride(true, false)).toBe(false);
      expect(applyFactOverride(true, undefined)).toBe(true);
    });

    it('maps queried rows into contract, deposit, and billing path', () => {
      expect(
        resolveOnboardingFacts({
          hasSignedContract: true,
          installmentDepositPaid: false,
          legacyPaymentExists: null,
          paymentMethod: 'Self-Pay',
          forceDepositPaid: true,
        })
      ).toEqual({
        contract_signed: true,
        deposit_paid: true,
        billing_path: 'self_pay',
        payment_method: 'Self-Pay',
      });
    });

    it('counts only the domain paid-installment statuses', () => {
      expect(isPaidInstallmentStatus('Paid')).toBe(true);
      expect(isPaidInstallmentStatus('succeeded')).toBe(true);
      expect(isPaidInstallmentStatus('completed')).toBe(true);
      expect(isPaidInstallmentStatus('pending')).toBe(false);
    });

    it('uses the stored-method on-file flag as the eligibility card fact', () => {
      expect(
        resolveCardOnFileFact({
          onFile: true,
          paymentMethodReference: 'pm_1',
        })
      ).toEqual({
        card_on_file: true,
        qb_stored_payment_method_id: 'pm_1',
      });
    });
  });

  describe('invite copy and cache miss', () => {
    it('explains a self-pay unsigned contract with the deposit requirement', () => {
      expect(inviteBlockerMessage('contract_unsigned', 'self_pay')).toBe(
        'Invite available after contract is signed and deposit is paid.'
      );
    });

    it('explains a non-deposit unsigned contract without requiring a deposit', () => {
      expect(inviteBlockerMessage('contract_unsigned', 'medicaid')).toBe(
        'Invite available after contract is signed and billing readiness is satisfied.'
      );
    });

    it('keeps the list cache-miss snapshot on billing path unknown only', () => {
      expect(readinessNotYetComputedSnapshot()).toMatchObject({
        is_eligible: false,
        portal_blockers: ['billing_path_unknown'],
        primary_portal_blocker: 'billing_path_unknown',
        payment_authorization_satisfied: false,
        allowed_actions: {
          can_invite_to_portal: false,
          can_mark_contract_signed: true,
          can_mark_deposit_paid: false,
        },
      });
    });
  });

  describe('eligibility transition', () => {
    it('unlocks, locks, or stays unchanged', () => {
      expect(portalEligibilityTransition(false, true)).toBe('unlocked');
      expect(portalEligibilityTransition(true, false)).toBe('locked');
      expect(portalEligibilityTransition(true, true)).toBe('unchanged');
    });
  });
});
