/**
 * Pure public-intake validation + normalization (PR 8).
 * No Express, DB, email, or env access.
 */
import {
  INSURANCE_PLAN_TYPES,
  INSURANCE_POLICY_HOLDER_RELATIONSHIPS,
  parseInsurancePolicyHolderDob,
} from '../../../billing/expandedInsuranceBilling';
import { parseIntakeReferral } from '../../../constants/referralSource';
import { ValidationError } from '../../../domains/errors';
import { RequestFormData } from '../../../types';
import {
  clientAgeRangeFromYears,
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

function presentString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
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

function resolveServiceNeeded(raw: Record<string, any>): string | null {
  const explicit = presentString(raw.service_needed);
  if (explicit) return explicit;
  if (Array.isArray(raw.services_interested)) {
    const items = raw.services_interested
      .map((item: unknown) =>
        typeof item === 'string' ? item.trim() : String(item ?? '').trim()
      )
      .filter((item: string) => item.length > 0);
    if (items.length > 0) return items.join(', ');
  }
  return null;
}

function hasDueDate(value: unknown): boolean {
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  if (typeof value === 'string') return value.trim().length > 0;
  return false;
}

function assertDueDateParseable(value: unknown): void {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new ValidationError('due_date must be a valid date');
    }
    return;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      throw new ValidationError('due_date must be a valid date');
    }
  }
}

function isPrimaryLanguageOther(value: unknown): boolean {
  return presentString(value)?.toLowerCase() === 'other';
}

/**
 * Validate and normalize a raw CRM public request-form body into `RequestFormData`.
 * Throws `ValidationError` with the same messages the legacy service used.
 *
 * Nancy Cowans (2026-10-09): required are first/last name, email, phone, city,
 * zip, due date, service requested, why-doula (`service_support_details`), and
 * `primary_language_other` only when primary language is Other.
 */
export function normalizePublicIntakeSubmission(
  formData: unknown
): RequestFormData {
  const raw = (formData ?? {}) as Record<string, any>;

  // Reject before any other validation and never include the supplied value in
  // the error. This legacy field must not become a card-data ingestion path.
  if (trimNullableString(raw.self_pay_card_info)) {
    throw new ValidationError(
      'self_pay_card_info is deprecated; payment cards must use the tokenized provider flow'
    );
  }

  const firstname = presentString(raw.firstname);
  const lastname = presentString(raw.lastname);
  const email = presentString(raw.email);
  const phone = presentString(raw.phone_number);
  const city = presentString(raw.city);
  const zipCode = presentString(raw.zip_code);
  const serviceNeeded = resolveServiceNeeded(raw);
  const serviceSupportDetails = presentString(raw.service_support_details);
  const primaryLanguage = presentString(raw.primary_language);
  const primaryLanguageOther = presentString(raw.primary_language_other);

  const missing: string[] = [];
  if (!firstname) missing.push('firstname');
  if (!lastname) missing.push('lastname');
  if (!email) missing.push('email');
  if (!phone) missing.push('phone_number');
  if (!city) missing.push('city');
  if (!zipCode) missing.push('zip_code');
  if (!hasDueDate(raw.due_date)) missing.push('due_date');
  if (!serviceNeeded) missing.push('service_needed');
  if (!serviceSupportDetails) missing.push('service_support_details');
  if (isPrimaryLanguageOther(raw.primary_language) && !primaryLanguageOther) {
    missing.push('primary_language_other');
  }
  if (missing.length > 0) {
    throw new ValidationError(`Missing required fields: ${missing.join(', ')}`);
  }

  assertDueDateParseable(raw.due_date);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(String(email))) {
    throw new ValidationError('Invalid email format');
  }

  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
  if (!phoneRegex.test(String(phone).replace(/[\s\-\(\)]/g, ''))) {
    throw new ValidationError('Invalid phone number format');
  }

  const zipRegex = /^\d{5}(-\d{4})?$/;
  if (!zipRegex.test(String(zipCode))) {
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

  const homeAdults = parseIntakeHomePeopleCount(
    raw.home_adults_count,
    'home_adults_count'
  );
  if (homeAdults.ok === false) {
    throw new ValidationError(homeAdults.message);
  }
  const homeYouth = parseIntakeHomePeopleCount(
    raw.home_youth_count,
    'home_youth_count'
  );
  if (homeYouth.ok === false) {
    throw new ValidationError(homeYouth.message);
  }
  const homeTypes = normalizeIntakeHomeTypes(raw.home_types ?? raw.home_type);
  const homeTypeOther = trimNullableString(raw.home_type_other);

  const birthPlace = validateIntakeBirthPlace(
    raw.birth_location,
    raw.birth_hospital
  );
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
  const hasSecondaryInsurance = normalizeOptionalBoolean(
    raw.has_secondary_insurance
  );
  const secondaryInsuranceProvider = trimNullableString(
    raw.secondary_insurance_provider
  );
  const secondaryInsuranceMemberId = trimNullableString(
    raw.secondary_insurance_member_id
  );
  const secondaryPolicyNumber = trimNullableString(raw.secondary_policy_number);
  const insurancePolicyHolderName = trimNullableString(
    raw.insurance_policy_holder_name
  );
  const parsedHolderDob = parseInsurancePolicyHolderDob(
    raw.insurance_policy_holder_dob
  );
  if (parsedHolderDob.ok === false) {
    throw new ValidationError(parsedHolderDob.message);
  }
  const insurancePolicyHolderDob = parsedHolderDob.value;
  const insurancePolicyHolderRelationship = trimNullableString(
    raw.insurance_policy_holder_relationship
  );
  const insurancePlanType = trimNullableString(raw.insurance_plan_type);

  // Insurance details are optional even when Commercial is chosen. If the
  // client did fill them, reject invalid enum values.
  if (requiresInsurance) {
    if (
      insurancePolicyHolderRelationship &&
      !INSURANCE_POLICY_HOLDER_RELATIONSHIPS.has(
        insurancePolicyHolderRelationship
      )
    ) {
      throw new ValidationError(
        'insurance_policy_holder_relationship must be one of: Self, Spouse, Partner, Parent, Child, Sibling, Other'
      );
    }
    if (insurancePlanType && !INSURANCE_PLAN_TYPES.has(insurancePlanType)) {
      throw new ValidationError(
        'insurance_plan_type must be one of: HMO, PPO, EPO, POS, HDHP, Medicaid, Medicare, Other'
      );
    }
  }

  const persistedLanguage =
    isPrimaryLanguageOther(raw.primary_language) && primaryLanguageOther
      ? primaryLanguageOther
      : primaryLanguage;

  const providedAgeRange = presentString(raw.client_age_range);
  const derivedAgeRange =
    ageResult.value != null ? clientAgeRangeFromYears(ageResult.value) : null;

  return {
    firstname: firstname as string,
    lastname: lastname as string,
    email: email as string,
    phone_number: phone as string,
    preferred_contact_method: raw.preferred_contact_method,
    preferred_name: raw.preferred_name,
    pronouns: raw.pronouns,
    pronouns_other: raw.pronouns_other,
    intake_age_years: ageResult.value ?? undefined,

    address: presentString(raw.address) ?? undefined,
    city: city as string,
    state: (presentString(raw.state) ?? undefined) as RequestFormData['state'],
    zip_code: zipCode as string,
    home_phone: raw.home_phone,
    home_types: homeTypes ?? undefined,
    home_type_other: homeTypeOther ?? undefined,
    home_access: trimNullableString(raw.home_access) ?? undefined,
    home_adults_count: homeAdults.value ?? undefined,
    home_youth_count: homeYouth.value ?? undefined,
    pets: raw.pets,

    relationship_status: raw.relationship_status,
    first_name: raw.first_name,
    last_name: raw.last_name,
    middle_name: raw.middle_name,
    mobile_phone: raw.mobile_phone,
    work_phone: raw.work_phone,

    referral_source: referral.referral_source ?? undefined,
    referral_name: referral.referral_name ?? undefined,
    referral_email: referral.referral_email ?? undefined,
    referral_source_other: referral.referral_source_other ?? undefined,

    health_history: raw.health_history,
    allergies: raw.allergies,
    health_notes: raw.health_notes,

    payment_method: paymentMethod ?? undefined,
    insurance_provider: requiresInsurance ? (insuranceProvider ?? null) : null,
    insurance_member_id: requiresInsurance ? (insuranceMemberId ?? null) : null,
    insurance_policy_holder_name: requiresInsurance
      ? (insurancePolicyHolderName ?? null)
      : null,
    insurance_policy_holder_dob: requiresInsurance
      ? (insurancePolicyHolderDob ?? null)
      : null,
    insurance_policy_holder_relationship: requiresInsurance
      ? (insurancePolicyHolderRelationship ?? null)
      : null,
    insurance_plan_type: requiresInsurance ? (insurancePlanType ?? null) : null,
    policy_number: requiresInsurance ? (policyNumber ?? null) : null,
    insurance_phone_number: requiresInsurance
      ? (insurancePhoneNumber ?? null)
      : null,
    has_secondary_insurance: requiresInsurance
      ? (hasSecondaryInsurance ?? null)
      : false,
    secondary_insurance_provider:
      requiresInsurance && hasSecondaryInsurance === true
        ? (secondaryInsuranceProvider ?? null)
        : null,
    secondary_insurance_member_id:
      requiresInsurance && hasSecondaryInsurance === true
        ? (secondaryInsuranceMemberId ?? null)
        : null,
    secondary_policy_number:
      requiresInsurance && hasSecondaryInsurance === true
        ? (secondaryPolicyNumber ?? null)
        : null,
    annual_income: raw.annual_income,
    service_needed: serviceNeeded as RequestFormData['service_needed'],
    service_specifics: raw.service_specifics,

    due_date: raw.due_date,
    birth_location: birthPlace.birth_location ?? undefined,
    birth_hospital: birthPlace.birth_hospital ?? undefined,
    number_of_babies: raw.number_of_babies,
    baby_name: raw.baby_name,
    provider_type: providerResult.value ?? undefined,
    pregnancy_number: raw.pregnancy_number,

    had_previous_pregnancies: raw.had_previous_pregnancies,
    previous_pregnancies_count: raw.previous_pregnancies_count,
    living_children_count: raw.living_children_count,
    past_pregnancy_experience: raw.past_pregnancy_experience,

    services_interested: raw.services_interested,
    service_support_details: serviceSupportDetails ?? undefined,

    race_ethnicity: raw.race_ethnicity,
    primary_language: persistedLanguage ?? undefined,
    primary_language_other: primaryLanguageOther ?? undefined,
    client_age_range: (providedAgeRange ??
      derivedAgeRange ??
      undefined) as RequestFormData['client_age_range'],
    insurance: requiresInsurance ? (raw.insurance ?? null) : null,
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
  data: RequestFormData
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
  right: Record<string, unknown>
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
