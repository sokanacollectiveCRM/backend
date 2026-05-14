/**
 * Shared rules for primary insurance (Commercial / Private / Medicaid parity).
 * Used by client billing APIs and public intake (request form).
 */

export const PAYMENT_METHODS_REQUIRING_PRIMARY_INSURANCE = new Set([
  'Commercial Insurance',
  'Private Insurance',
  'Medicaid',
]);

export const INSURANCE_POLICY_HOLDER_RELATIONSHIPS = new Set([
  'Self',
  'Spouse',
  'Partner',
  'Parent',
  'Child',
  'Sibling',
  'Other',
]);

export const INSURANCE_PLAN_TYPES = new Set([
  'HMO',
  'PPO',
  'EPO',
  'POS',
  'HDHP',
  'Medicaid',
  'Medicare',
  'Other',
]);

/**
 * Normalize policy holder DOB to YYYY-MM-DD for Postgres `date`.
 * Accepts leading ISO-8601 date or date-only string.
 */
export function parseInsurancePolicyHolderDob(
  raw: unknown
): { ok: true; value: string | null } | { ok: false; message: string } {
  if (raw === undefined || raw === null) {
    return { ok: true, value: null };
  }
  if (typeof raw !== 'string') {
    return { ok: false, message: 'insurance_policy_holder_dob must be a string' };
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: true, value: null };
  }
  const m = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!m) {
    return {
      ok: false,
      message: 'insurance_policy_holder_dob must start with an ISO calendar date (YYYY-MM-DD)',
    };
  }
  const datePart = m[1];
  const d = new Date(`${datePart}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    return { ok: false, message: 'insurance_policy_holder_dob is not a valid date' };
  }
  if (d.toISOString().slice(0, 10) !== datePart) {
    return { ok: false, message: 'insurance_policy_holder_dob is not a valid calendar date' };
  }
  return { ok: true, value: datePart };
}

export type PrimaryInsuranceValidationInput = {
  insuranceProvider: string | null;
  insuranceMemberId: string | null;
  insurancePolicyHolderName: string | null;
  insurancePolicyHolderDob: string | null;
  insurancePolicyHolderRelationship: string | null;
  insurancePlanType: string | null;
  hasSecondaryInsurance: boolean | null | undefined;
  secondaryInsuranceProvider: string | null;
  secondaryInsuranceMemberId: string | null;
  secondaryPolicyNumber: string | null;
};

/**
 * Validates primary + secondary insurance when payment is not Self-Pay.
 * `policy_number` (group number) is optional for all insurance payment methods.
 */
export function validatePrimaryInsuranceWhenRequired(
  input: PrimaryInsuranceValidationInput
): { ok: true } | { ok: false; message: string } {
  if (!input.insuranceProvider) {
    return { ok: false, message: 'insurance_provider is required when payment_method is not Self-Pay' };
  }
  if (!input.insuranceMemberId) {
    return { ok: false, message: 'insurance_member_id is required when payment_method is not Self-Pay' };
  }
  if (!input.insurancePolicyHolderName) {
    return {
      ok: false,
      message: 'insurance_policy_holder_name is required when payment_method is not Self-Pay',
    };
  }
  if (!input.insurancePolicyHolderDob) {
    return {
      ok: false,
      message: 'insurance_policy_holder_dob is required when payment_method is not Self-Pay',
    };
  }
  if (!input.insurancePolicyHolderRelationship) {
    return {
      ok: false,
      message: 'insurance_policy_holder_relationship is required when payment_method is not Self-Pay',
    };
  }
  if (!INSURANCE_POLICY_HOLDER_RELATIONSHIPS.has(input.insurancePolicyHolderRelationship)) {
    return {
      ok: false,
      message:
        'insurance_policy_holder_relationship must be one of: Self, Spouse, Partner, Parent, Child, Sibling, Other',
    };
  }
  if (!input.insurancePlanType) {
    return { ok: false, message: 'insurance_plan_type is required when payment_method is not Self-Pay' };
  }
  if (!INSURANCE_PLAN_TYPES.has(input.insurancePlanType)) {
    return {
      ok: false,
      message:
        'insurance_plan_type must be one of: HMO, PPO, EPO, POS, HDHP, Medicaid, Medicare, Other',
    };
  }

  if (input.hasSecondaryInsurance === true) {
    if (!input.secondaryInsuranceProvider) {
      return {
        ok: false,
        message: 'secondary_insurance_provider is required when has_secondary_insurance is true',
      };
    }
    if (!input.secondaryInsuranceMemberId) {
      return {
        ok: false,
        message: 'secondary_insurance_member_id is required when has_secondary_insurance is true',
      };
    }
    if (!input.secondaryPolicyNumber) {
      return {
        ok: false,
        message: 'secondary_policy_number is required when has_secondary_insurance is true',
      };
    }
  }

  return { ok: true };
}
