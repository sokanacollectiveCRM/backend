import { validatePrimaryInsuranceWhenRequired } from '../billing/expandedInsuranceBilling';
import {
  INTAKE_PAYMENT_METHOD_OPTIONS,
  parseIntakeClientAgeYears,
  parseIntakePaymentMethod,
  parseIntakeProviderType,
  validateIntakeBirthPlace,
} from '../intake/requestSubmissionDto';
import { ProviderType } from '../types';

describe('requestSubmissionDto', () => {
  describe('validateIntakeBirthPlace', () => {
    it('rejects empty birth_hospital when birth_location is set', () => {
      const r = validateIntakeBirthPlace('Hospital', '');
      expect(r.ok).toBe(false);
      if (r.ok === false) {
        expect(r.message).toBe('Please enter the hospital name.');
      }
    });

    it.each([
      ['Home', '', 'Please enter your home birth location (e.g. home address).'],
      ['Hospital', '   ', 'Please enter the hospital name.'],
      ['Birth Center', '', 'Please enter the birth center name or location.'],
      ['Other', '  ', 'Please enter your birth location name.'],
    ])('location %p with missing place', (location, place, message) => {
      const r = validateIntakeBirthPlace(location, place);
      expect(r).toEqual({ ok: false, message });
    });

    it.each(['Home', 'Hospital', 'Birth Center', 'Other'] as const)(
      'accepts %p with non-empty birth_hospital',
      (location) => {
        const r = validateIntakeBirthPlace(location, 'Place name');
        expect(r).toEqual({
          ok: true,
          birth_location: location,
          birth_hospital: 'Place name',
        });
      }
    );

    it('rejects unknown birth_location', () => {
      expect(validateIntakeBirthPlace('Clinic', 'Somewhere')).toEqual({
        ok: false,
        message: 'birth_location must be one of: Hospital, Home, Birth Center, Other',
      });
    });

    it('rejects missing birth_location', () => {
      expect(validateIntakeBirthPlace('', 'Mercy')).toEqual({
        ok: false,
        message: 'birth_location is required',
      });
    });
  });

  describe('parseIntakePaymentMethod', () => {
    it('rejects Medicaid on public intake', () => {
      const r = parseIntakePaymentMethod('Medicaid');
      expect(r.ok).toBe(false);
      if (r.ok === false) {
        expect(r.message).toContain('Medicaid');
      }
    });

    it.each(INTAKE_PAYMENT_METHOD_OPTIONS)('accepts intake label %p', (label) => {
      const r = parseIntakePaymentMethod(label);
      expect(r.ok).toBe(true);
    });

    it('maps Private/Commercial Insurance to Commercial Insurance with insurance required', () => {
      expect(parseIntakePaymentMethod('Private/Commercial Insurance')).toEqual({
        ok: true,
        value: 'Commercial Insurance',
        requiresInsurance: true,
      });
    });

    it.each([
      ['Self-Pay, Sliding Scale Available', false],
      ['I am unable to pay / Full Support Option', false],
      ['Not sure / Need help figuring this out', false],
    ])('%p does not require insurance', (label, requiresInsurance) => {
      expect(parseIntakePaymentMethod(label)).toEqual({
        ok: true,
        value: label,
        requiresInsurance,
      });
    });

    it('rejects legacy staff labels on intake', () => {
      expect(parseIntakePaymentMethod('Commercial Insurance').ok).toBe(false);
      expect(parseIntakePaymentMethod('Self-Pay').ok).toBe(false);
    });
  });

  describe('parseIntakeClientAgeYears', () => {
    it.each([
      [1, 1],
      [120, 120],
      ['1', 1],
      ['120', 120],
      ['30', 30],
    ])('accepts %p as %p', (raw, expected) => {
      const r = parseIntakeClientAgeYears(raw);
      expect(r).toEqual({ ok: true, value: expected });
    });

    it.each([
      [0, 'age must be between 1 and 120'],
      [121, 'age must be between 1 and 120'],
      ['0', 'age must be between 1 and 120'],
      ['121', 'age must be between 1 and 120'],
      ['', 'age is required'],
      [null, 'age is required'],
      [undefined, 'age is required'],
      [12.5, 'age must be a whole number between 1 and 120'],
      ['12.5', 'age must be a whole number between 1 and 120'],
      ['abc', 'age must be a whole number between 1 and 120'],
      [{}, 'age must be a number or numeric string'],
    ])('rejects %p with message %p', (raw, message) => {
      const r = parseIntakeClientAgeYears(raw);
      expect(r).toEqual({ ok: false, message });
    });
  });

  describe('parseIntakeProviderType', () => {
    it.each([
      ['Midwife', ProviderType.MIDWIFE],
      ['OB', ProviderType.OB],
      ['Family Physician', ProviderType.FAMILY_PHYSICIAN],
      ['Other', ProviderType.OTHER],
      ['Family Doctor', ProviderType.FAMILY_PHYSICIAN],
    ])('accepts %p', (raw, expected) => {
      const r = parseIntakeProviderType(raw);
      expect(r).toEqual({ ok: true, value: expected });
    });

    it('trims whitespace', () => {
      expect(parseIntakeProviderType('  Midwife  ')).toEqual({
        ok: true,
        value: ProviderType.MIDWIFE,
      });
    });

    it('rejects unknown provider labels', () => {
      const r = parseIntakeProviderType('Chiropractor');
      expect(r.ok).toBe(false);
      if (r.ok === false) {
        expect(r.message).toContain('provider_type must be one of:');
        expect(r.message).toContain('OB');
      }
    });

    it.each([[''], ['   ']])('rejects empty provider_type %p', (raw) => {
      expect(parseIntakeProviderType(raw)).toEqual({
        ok: false,
        message: 'provider_type is required',
      });
    });
  });

  describe('validatePrimaryInsuranceWhenRequired (secondary path)', () => {
    const basePrimary = {
      insuranceProvider: 'Blue Cross',
      insuranceMemberId: 'M1',
      insurancePolicyHolderName: 'Jane',
      insurancePolicyHolderDob: '1990-01-02',
      insurancePolicyHolderRelationship: 'Self' as const,
      insurancePlanType: 'PPO' as const,
    };

    it('requires secondary fields when has_secondary_insurance is true', () => {
      const r = validatePrimaryInsuranceWhenRequired({
        ...basePrimary,
        hasSecondaryInsurance: true,
        secondaryInsuranceProvider: 'Sec Co',
        secondaryInsuranceMemberId: 'SEC-1',
        secondaryPolicyNumber: null,
      });
      expect(r).toEqual({
        ok: false,
        message: 'secondary_policy_number is required when has_secondary_insurance is true',
      });
    });

    it('passes when secondary fields are complete', () => {
      expect(
        validatePrimaryInsuranceWhenRequired({
          ...basePrimary,
          hasSecondaryInsurance: true,
          secondaryInsuranceProvider: 'Sec Co',
          secondaryInsuranceMemberId: 'SEC-1',
          secondaryPolicyNumber: 'SEC-POL',
        })
      ).toEqual({ ok: true });
    });
  });
});
