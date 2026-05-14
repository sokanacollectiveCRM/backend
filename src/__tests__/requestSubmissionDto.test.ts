import { validatePrimaryInsuranceWhenRequired } from '../billing/expandedInsuranceBilling';
import {
  normalizeIntakePaymentMethod,
  parseIntakeClientAgeYears,
  parseIntakeProviderType,
} from '../intake/requestSubmissionDto';
import { ProviderType } from '../types';

describe('requestSubmissionDto', () => {
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

  describe('normalizeIntakePaymentMethod', () => {
    it('maps CRM Private/Commercial label to Commercial Insurance', () => {
      expect(normalizeIntakePaymentMethod('Private/Commercial Insurance')).toBe(
        'Commercial Insurance'
      );
    });

    it('passes through canonical backend labels', () => {
      expect(normalizeIntakePaymentMethod('Medicaid')).toBe('Medicaid');
      expect(normalizeIntakePaymentMethod('Self-Pay')).toBe('Self-Pay');
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
