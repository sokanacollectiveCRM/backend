/**
 * Pure public-intake validation + normalization (PR 8).
 * No Express, DB, email, or env access.
 */

import { ValidationError } from '../../../domains/errors';
import { parseIntakeReferral } from '../../../constants/referralSource';
import {
  parseInsurancePolicyHolderDob,
  validatePrimaryInsuranceWhenRequired,
} from '../../../billing/expandedInsuranceBilling';
import { RequestFormData } from '../../../types';
import {
  normalizeIntakeHomeTypes,
  parseIntakeClientAgeYears,
  parseIntakeHomePeopleCount,
  parseIntakePaymentMethod,
  parseIntakeProviderType,
  validateIntakeBirthPlace,
} from './requestSubmissionDto';

function trimNullableString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeOptionalBoolean(value: unknown): boolean | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  }
  return undefined;
}

/**
 * Validate and normalize a raw CRM public request-form body into `RequestFormData`.
 * Throws `ValidationError` with the same messages the legacy service used.
 */
export function normalizePublicIntakeSubmission(formData: unknown): RequestFormData {
  const raw = (formData ?? {}) as Record<string, any>;

  if (!raw.firstname || !raw.lastname) {
    throw new ValidationError('Missing required fields: first name and last name');
  }

  if (!raw.service_needed) {
    throw new ValidationError('Missing required field: service_needed');
  }

  if (!raw.email || !String(raw.email).includes('@')) {
    throw new ValidationError('Valid email is required');
  }

  if (!raw.phone_number) {
    throw new ValidationError('Phone number is required');
  }

  if (!raw.address || !raw.city || !raw.state || !raw.zip_code) {
    throw new ValidationError('Complete address is required');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(String(raw.email))) {
    throw new ValidationError('Invalid email format');
  }

  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
  if (!phoneRegex.test(String(raw.phone_number).replace(/[\s\-\(\)]/g, ''))) {
    throw new ValidationError('Invalid phone number format');
  }

  const zipRegex = /^\d{5}(-\d{4})?$/;
  if (!zipRegex.test(String(raw.zip_code))) {
    throw new ValidationError('Invalid zip code format');
  }

  const referral = parseIntakeReferral(raw);

  const ageResult = parseIntakeClientAgeYears(raw.age);
  if (ageResult.ok === false) {
    throw new ValidationError(ageResult.message);
  }

  const providerResult = parseIntakeProviderType(raw.provider_type);
  if (providerResult.ok === false) {
    throw new ValidationError(providerResult.message);
  }

  const homeAdults = parseIntakeHomePeopleCount(raw.home_adults_count, 'home_adults_count');
  if (homeAdults.ok === false) {
    throw new ValidationError(homeAdults.message);
  }
  const homeYouth = parseIntakeHomePeopleCount(raw.home_youth_count, 'home_youth_count');
  if (homeYouth.ok === false) {
    throw new ValidationError(homeYouth.message);
  }
  const homeTypes = normalizeIntakeHomeTypes(raw.home_types ?? raw.home_type);
  const homeTypeOther = trimNullableString(raw.home_type_other);

  const birthPlace = validateIntakeBirthPlace(raw.birth_location, raw.birth_hospital);
  if (birthPlace.ok === false) {
    throw new ValidationError(birthPlace.message);
  }

  const paymentResult = parseIntakePaymentMethod(raw.payment_method);
  if (paymentResult.ok === false) {
    throw new ValidationError(paymentResult.message);
  }
  const paymentMethod = paymentResult.value;
  const requiresInsurance = paymentResult.requiresInsurance;

  const insuranceProvider = trimNullableString(raw.insurance_provider);
  const insuranceMemberId = trimNullableString(raw.insurance_member_id);
  const policyNumber = trimNullableString(raw.policy_number);
  const insurancePhoneNumber = trimNullableString(raw.insurance_phone_number);
  const hasSecondaryInsurance = normalizeOptionalBoolean(raw.has_secondary_insurance);
  const secondaryInsuranceProvider = trimNullableString(raw.secondary_insurance_provider);
  const secondaryInsuranceMemberId = trimNullableString(raw.secondary_insurance_member_id);
  const secondaryPolicyNumber = trimNullableString(raw.secondary_policy_number);
  const selfPayCardInfo = trimNullableString(raw.self_pay_card_info);
  const insurancePolicyHolderName = trimNullableString(raw.insurance_policy_holder_name);
  const parsedHolderDob = parseInsurancePolicyHolderDob(raw.insurance_policy_holder_dob);
  if (parsedHolderDob.ok === false) {
    throw new ValidationError(parsedHolderDob.message);
  }
  const insurancePolicyHolderDob = parsedHolderDob.value;
  const insurancePolicyHolderRelationship = trimNullableString(
    raw.insurance_policy_holder_relationship,
  );
  const insurancePlanType = trimNullableString(raw.insurance_plan_type);

  if (requiresInsurance) {
    const primaryCheck = validatePrimaryInsuranceWhenRequired({
      insuranceProvider,
      insuranceMemberId,
      insurancePolicyHolderName,
      insurancePolicyHolderDob,
      insurancePolicyHolderRelationship,
      insurancePlanType,
      hasSecondaryInsurance,
      secondaryInsuranceProvider,
      secondaryInsuranceMemberId,
      secondaryPolicyNumber,
    });
    if (primaryCheck.ok === false) {
      throw new ValidationError(primaryCheck.message);
    }
  }

  return {
    firstname: raw.firstname,
    lastname: raw.lastname,
    email: raw.email,
    phone_number: raw.phone_number,
    preferred_contact_method: raw.preferred_contact_method,
    preferred_name: raw.preferred_name,
    pronouns: raw.pronouns,
    pronouns_other: raw.pronouns_other,
    intake_age_years: ageResult.value,

    address: raw.address,
    city: raw.city,
    state: raw.state,
    zip_code: raw.zip_code,
    home_phone: raw.home_phone,
    home_types: homeTypes ?? undefined,
    home_type_other: homeTypeOther ?? undefined,
    home_access: trimNullableString(raw.home_access) ?? undefined,
    home_adults_count: homeAdults.value,
    home_youth_count: homeYouth.value,
    pets: raw.pets,

    relationship_status: raw.relationship_status,
    first_name: raw.first_name,
    last_name: raw.last_name,
    middle_name: raw.middle_name,
    mobile_phone: raw.mobile_phone,
    work_phone: raw.work_phone,

    referral_source: referral.referral_source,
    referral_name: referral.referral_name ?? undefined,
    referral_email: referral.referral_email ?? undefined,
    referral_source_other: referral.referral_source_other ?? undefined,

    health_history: raw.health_history,
    allergies: raw.allergies,
    health_notes: raw.health_notes,

    payment_method: paymentMethod,
    insurance_provider: requiresInsurance ? insuranceProvider ?? null : null,
    insurance_member_id: requiresInsurance ? insuranceMemberId ?? null : null,
    insurance_policy_holder_name: requiresInsurance ? insurancePolicyHolderName ?? null : null,
    insurance_policy_holder_dob: requiresInsurance ? insurancePolicyHolderDob ?? null : null,
    insurance_policy_holder_relationship: requiresInsurance
      ? insurancePolicyHolderRelationship ?? null
      : null,
    insurance_plan_type: requiresInsurance ? insurancePlanType ?? null : null,
    policy_number: requiresInsurance ? policyNumber ?? null : null,
    insurance_phone_number: requiresInsurance ? insurancePhoneNumber ?? null : null,
    has_secondary_insurance: requiresInsurance ? (hasSecondaryInsurance ?? null) : false,
    secondary_insurance_provider:
      requiresInsurance && hasSecondaryInsurance === true ? secondaryInsuranceProvider ?? null : null,
    secondary_insurance_member_id:
      requiresInsurance && hasSecondaryInsurance === true ? secondaryInsuranceMemberId ?? null : null,
    secondary_policy_number:
      requiresInsurance && hasSecondaryInsurance === true ? secondaryPolicyNumber ?? null : null,
    self_pay_card_info: !requiresInsurance ? selfPayCardInfo ?? null : null,
    annual_income: raw.annual_income,
    service_needed: raw.service_needed,
    service_specifics: raw.service_specifics,

    due_date: raw.due_date,
    birth_location: birthPlace.birth_location,
    birth_hospital: birthPlace.birth_hospital,
    number_of_babies: raw.number_of_babies,
    baby_name: raw.baby_name,
    provider_type: providerResult.value,
    pregnancy_number: raw.pregnancy_number,

    had_previous_pregnancies: raw.had_previous_pregnancies,
    previous_pregnancies_count: raw.previous_pregnancies_count,
    living_children_count: raw.living_children_count,
    past_pregnancy_experience: raw.past_pregnancy_experience,

    services_interested: raw.services_interested,
    service_support_details: raw.service_support_details,

    race_ethnicity: raw.race_ethnicity,
    primary_language: raw.primary_language,
    client_age_range: raw.client_age_range,
    insurance: requiresInsurance ? raw.insurance ?? null : null,
    demographics_multi: raw.demographics_multi,
  };
}

/** Stable subset of keys used for shadow-compare telemetry (no free-text PHI dump). */
export const INTAKE_SHADOW_COMPARE_KEYS = [
  'firstname',
  'lastname',
  'email',
  'payment_method',
  'birth_location',
  'birth_hospital',
  'provider_type',
  'referral_source',
  'intake_age_years',
  'home_adults_count',
  'home_youth_count',
  'has_secondary_insurance',
  'service_needed',
] as const;

export function pickIntakeShadowCompareSlice(
  data: RequestFormData,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const record = data as unknown as Record<string, unknown>;
  for (const key of INTAKE_SHADOW_COMPARE_KEYS) {
    out[key] = record[key];
  }
  return out;
}

export function diffIntakeShadowSlices(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): string[] {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  const diffs: string[] = [];
  for (const key of keys) {
    if (JSON.stringify(left[key]) !== JSON.stringify(right[key])) {
      diffs.push(key);
    }
  }
  return diffs;
}
