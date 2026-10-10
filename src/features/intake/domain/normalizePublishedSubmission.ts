/**
 * Validate a public or test submission against a published (or draft) definition.
 * Standard answers still use the existing field parsers. Custom answers stay
 * in a JSON bag and are not written to new phi_clients columns.
 */
import {
  parseInsurancePolicyHolderDob,
  validatePrimaryInsuranceWhenRequired,
} from '../../../billing/expandedInsuranceBilling';
import { parseIntakeReferral } from '../../../constants/referralSource';
import { ValidationError } from '../../../domains/errors';
import { RequestFormData, ServiceTypes } from '../../../types';
import { STANDARD_FIELD_BY_KEY } from './intakeFormCatalog';
import {
  normalizeIntakeHomeTypes,
  parseIntakeClientAgeYears,
  parseIntakeHomePeopleCount,
  parseIntakePaymentMethod,
  parseIntakeProviderType,
  validateIntakeBirthPlace,
} from './requestSubmissionDto';
import {
  IntakeFormDefinition,
  IntakeFormQuestion,
} from './validateIntakeFormDefinition';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[\+]?[1-9][\d]{0,15}$/;
const ZIP_RE = /^\d{5}(-\d{4})?$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const IMAGE_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BABY_COUNTS: Record<string, number> = {
  Singleton: 1,
  Twins: 2,
  Triplets: 3,
  Quadruplets: 4,
};

export interface PreparedIntakeSubmission {
  data: RequestFormData;
  customAnswers: Record<string, unknown>;
}

export function normalizePublishedIntakeSubmission(
  formData: unknown,
  definition: IntakeFormDefinition
): PreparedIntakeSubmission {
  const raw = (formData ?? {}) as Record<string, unknown>;
  if (nonEmptyString(raw.self_pay_card_info)) {
    throw new ValidationError(
      'self_pay_card_info is deprecated; payment cards must use the tokenized provider flow'
    );
  }

  const questions = definition.steps.flatMap((step) => step.questions);
  const byKey = new Map(questions.map((question) => [question.key, question]));
  const customAnswers: Record<string, unknown> = {};
  const standard: Record<string, unknown> = {};

  for (const question of questions) {
    if (question.hidden === true) continue;
    const value = raw[question.key];
    if (isEmpty(value)) {
      if (question.required || isAlwaysRequired(question.key)) {
        throw new ValidationError(`${question.label} is required.`);
      }
      continue;
    }
    if (question.kind === 'custom') {
      customAnswers[question.key] = coerceCustomAnswer(question, value);
    } else {
      standard[question.key] = value;
    }
  }

  if (isEmpty(standard.firstname) || isEmpty(standard.lastname)) {
    throw new ValidationError('First name and last name are required.');
  }
  if (isEmpty(standard.email) && isEmpty(standard.phone_number)) {
    throw new ValidationError('Email or phone is required.');
  }
  if (
    !isEmpty(standard.email) &&
    !EMAIL_RE.test(String(standard.email).trim())
  ) {
    throw new ValidationError('Enter a valid email address.');
  }
  if (!isEmpty(standard.phone_number) && !validPhone(standard.phone_number)) {
    throw new ValidationError('Enter a valid phone number.');
  }

  const data = buildRequestFormData(standard, byKey);
  return { data, customAnswers };
}

function editedChoice(
  byKey: Map<string, IntakeFormQuestion>,
  key: string,
  value: unknown
): string | null {
  const question = byKey.get(key);
  if (question?.kind !== 'standard' || !question.options?.length) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!question.options.includes(trimmed)) return null;
  const catalog = STANDARD_FIELD_BY_KEY.get(key)?.options;
  if (catalog?.includes(trimmed)) return null;
  return trimmed;
}

function isAlwaysRequired(key: string): boolean {
  return key === 'firstname' || key === 'lastname';
}

function buildRequestFormData(
  standard: Record<string, unknown>,
  byKey: Map<string, IntakeFormQuestion>
): RequestFormData {
  assertSelects(standard, byKey);

  const text = (key: string): string | undefined => {
    const value = standard[key];
    if (isEmpty(value)) return undefined;
    return String(value).trim();
  };

  if (standard.age !== undefined) {
    const age = parseIntakeClientAgeYears(standard.age);
    if (age.ok === false) throw new ValidationError(age.message);
    standard.intake_age_years = age.value;
  }

  for (const key of ['home_adults_count', 'home_youth_count'] as const) {
    if (standard[key] === undefined) continue;
    const parsed = parseIntakeHomePeopleCount(standard[key], key);
    if (parsed.ok === false)
      throw new ValidationError(labelMessage(byKey, key, parsed.message));
    standard[key] = parsed.value;
  }

  if (standard.home_type !== undefined) {
    standard.home_types =
      normalizeIntakeHomeTypes(standard.home_type) ?? undefined;
  }

  if (
    standard.zip_code !== undefined &&
    !ZIP_RE.test(String(standard.zip_code).trim())
  ) {
    throw new ValidationError('Enter a valid zip code.');
  }

  if (standard.referral_source !== undefined) {
    const edited = editedChoice(
      byKey,
      'referral_source',
      standard.referral_source
    );
    if (edited) {
      standard.referral_source = edited;
    } else {
      const referral = parseIntakeReferral({
        referral_source: standard.referral_source,
        referral_name: standard.referral_name,
        referral_email: standard.referral_email,
        referral_source_other: standard.referral_source_other,
      });
      standard.referral_source = referral.referral_source;
      standard.referral_name = referral.referral_name;
      standard.referral_email = referral.referral_email;
      standard.referral_source_other = referral.referral_source_other;
    }
  }

  if (standard.provider_type !== undefined) {
    const edited = editedChoice(byKey, 'provider_type', standard.provider_type);
    if (edited) {
      standard.provider_type = edited;
    } else {
      const provider = parseIntakeProviderType(standard.provider_type);
      if (provider.ok === false) throw new ValidationError(provider.message);
      standard.provider_type = provider.value;
    }
  }

  if (byKey.has('birth_hospital') && standard.birth_location !== undefined) {
    const birth = validateIntakeBirthPlace(
      standard.birth_location,
      standard.birth_hospital
    );
    if (birth.ok === false) throw new ValidationError(birth.message);
    standard.birth_location = birth.birth_location;
    standard.birth_hospital = birth.birth_hospital;
  } else if (standard.birth_location !== undefined) {
    const edited = editedChoice(
      byKey,
      'birth_location',
      standard.birth_location
    );
    const location = edited ?? String(standard.birth_location).trim();
    if (
      !edited &&
      !['Hospital', 'Home', 'Birth Center', 'Other'].includes(location)
    ) {
      throw new ValidationError('Choose a birth location.');
    }
    standard.birth_location = location;
  }

  let paymentMethod: string | undefined;
  let requiresInsurance = false;
  if (standard.payment_method !== undefined) {
    const edited = editedChoice(
      byKey,
      'payment_method',
      standard.payment_method
    );
    const payment = parseIntakePaymentMethod(standard.payment_method);
    if (payment.ok === false) {
      if (!edited) throw new ValidationError(payment.message);
      paymentMethod = edited;
      requiresInsurance = edited === 'Commercial Insurance';
    } else {
      paymentMethod = payment.value;
      requiresInsurance = payment.requiresInsurance;
    }
  }

  if (standard.number_of_babies !== undefined) {
    const edited = editedChoice(
      byKey,
      'number_of_babies',
      standard.number_of_babies
    );
    if (edited && !BABY_COUNTS[edited]) {
      delete standard.number_of_babies;
    } else {
      standard.number_of_babies = coerceBabyCount(standard.number_of_babies);
    }
  }
  if (standard.had_previous_pregnancies !== undefined) {
    standard.had_previous_pregnancies = coerceBoolean(
      standard.had_previous_pregnancies
    );
  }
  if (standard.has_secondary_insurance !== undefined) {
    standard.has_secondary_insurance = coerceBoolean(
      standard.has_secondary_insurance
    );
  }
  for (const key of [
    'pregnancy_number',
    'previous_pregnancies_count',
    'living_children_count',
  ]) {
    if (standard[key] === undefined) continue;
    const parsed = Number(standard[key]);
    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new ValidationError(
        `${labelFor(byKey, key)} must be a whole number.`
      );
    }
    standard[key] = parsed;
  }

  const holderDob =
    standard.insurance_policy_holder_dob === undefined
      ? { ok: true as const, value: null }
      : parseInsurancePolicyHolderDob(standard.insurance_policy_holder_dob);
  if (holderDob.ok === false) throw new ValidationError(holderDob.message);

  if (
    requiresInsurance &&
    byKey.has('insurance_provider') &&
    byKey.has('insurance_member_id') &&
    byKey.has('insurance_policy_holder_name')
  ) {
    const primary = validatePrimaryInsuranceWhenRequired({
      insuranceProvider: text('insurance_provider') ?? null,
      insuranceMemberId: text('insurance_member_id') ?? null,
      insurancePolicyHolderName: text('insurance_policy_holder_name') ?? null,
      insurancePolicyHolderDob: holderDob.value,
      insurancePolicyHolderRelationship:
        text('insurance_policy_holder_relationship') ?? null,
      insurancePlanType: text('insurance_plan_type') ?? null,
      hasSecondaryInsurance:
        standard.has_secondary_insurance === undefined
          ? null
          : Boolean(standard.has_secondary_insurance),
      secondaryInsuranceProvider: text('secondary_insurance_provider') ?? null,
      secondaryInsuranceMemberId: text('secondary_insurance_member_id') ?? null,
      secondaryPolicyNumber: text('secondary_policy_number') ?? null,
    });
    if (primary.ok === false) throw new ValidationError(primary.message);
  }

  const services = Array.isArray(standard.services_interested)
    ? standard.services_interested.map((item) => String(item))
    : undefined;
  const serviceNeeded =
    (services && services.length > 0 ? services.join(', ') : '') ||
    text('service_support_details') ||
    'Request for service';

  return {
    firstname: String(standard.firstname).trim(),
    lastname: String(standard.lastname).trim(),
    email: text('email') ?? '',
    phone_number: text('phone_number') ?? '',
    preferred_contact_method: text('preferred_contact_method'),
    preferred_name: text('preferred_name'),
    pronouns: text('pronouns') as RequestFormData['pronouns'],
    pronouns_other: text('pronouns_other'),
    intake_age_years: standard.intake_age_years as number | undefined,
    children_expected: text('children_expected'),
    address: text('address') ?? '',
    city: text('city') ?? '',
    state: text('state') as RequestFormData['state'],
    zip_code: text('zip_code') ?? '',
    home_types: standard.home_types as string[] | undefined,
    home_type_other: text('home_type_other'),
    home_access: text('home_access'),
    pets: text('pets'),
    home_adults_count: text('home_adults_count'),
    home_youth_count: text('home_youth_count'),
    referral_source: text('referral_source'),
    referral_name: text('referral_name'),
    referral_email: text('referral_email'),
    referral_source_other:
      (standard.referral_source_other as string | null) ?? undefined,
    health_history: text('health_history'),
    allergies: text('allergies'),
    health_notes: text('health_notes'),
    payment_method: paymentMethod,
    insurance_provider: requiresInsurance
      ? (text('insurance_provider') ?? null)
      : null,
    insurance_member_id: requiresInsurance
      ? (text('insurance_member_id') ?? null)
      : null,
    insurance_policy_holder_name: requiresInsurance
      ? (text('insurance_policy_holder_name') ?? null)
      : null,
    insurance_policy_holder_dob: requiresInsurance ? holderDob.value : null,
    insurance_policy_holder_relationship: requiresInsurance
      ? (text('insurance_policy_holder_relationship') ?? null)
      : null,
    insurance_plan_type: requiresInsurance
      ? (text('insurance_plan_type') ?? null)
      : null,
    policy_number: requiresInsurance ? (text('policy_number') ?? null) : null,
    insurance_phone_number: requiresInsurance
      ? (text('insurance_phone_number') ?? null)
      : null,
    has_secondary_insurance: requiresInsurance
      ? ((standard.has_secondary_insurance as boolean | undefined) ?? null)
      : false,
    secondary_insurance_provider:
      requiresInsurance && standard.has_secondary_insurance === true
        ? (text('secondary_insurance_provider') ?? null)
        : null,
    secondary_insurance_member_id:
      requiresInsurance && standard.has_secondary_insurance === true
        ? (text('secondary_insurance_member_id') ?? null)
        : null,
    secondary_policy_number:
      requiresInsurance && standard.has_secondary_insurance === true
        ? (text('secondary_policy_number') ?? null)
        : null,
    annual_income: text('annual_income') as RequestFormData['annual_income'],
    service_needed: serviceNeeded as ServiceTypes,
    due_date: text('due_date') ? new Date(String(text('due_date'))) : undefined,
    birth_location: text('birth_location'),
    birth_hospital:
      (standard.birth_hospital as string | null | undefined) ?? undefined,
    number_of_babies: standard.number_of_babies as number | undefined,
    baby_name: text('baby_name'),
    provider_type: standard.provider_type as RequestFormData['provider_type'],
    pregnancy_number: standard.pregnancy_number as number | undefined,
    had_previous_pregnancies: standard.had_previous_pregnancies as
      | boolean
      | undefined,
    previous_pregnancies_count: standard.previous_pregnancies_count as
      | number
      | undefined,
    living_children_count: standard.living_children_count as number | undefined,
    past_pregnancy_experience: text('past_pregnancy_experience'),
    services_interested: services,
    service_support_details: text('service_support_details'),
    race_ethnicity: text('race_ethnicity'),
    primary_language: text('primary_language'),
    client_age_range: text(
      'client_age_range'
    ) as RequestFormData['client_age_range'],
    insurance: text('insurance'),
    demographics_multi: Array.isArray(standard.demographics_multi)
      ? standard.demographics_multi.map((item) => String(item))
      : undefined,
  };
}

function assertSelects(
  standard: Record<string, unknown>,
  byKey: Map<string, IntakeFormQuestion>
): void {
  for (const [key, value] of Object.entries(standard)) {
    const catalog = STANDARD_FIELD_BY_KEY.get(key);
    const question = byKey.get(key);
    const listed =
      question?.kind === 'standard' &&
      question.options &&
      question.options.length > 0
        ? question.options
        : catalog?.options;
    if (!listed || value == null) continue;
    const allowed = new Set(listed);
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      if (
        typeof item === 'string' &&
        item.trim() &&
        !allowed.has(item.trim())
      ) {
        throw new ValidationError(
          `Choose a valid option for ${labelFor(byKey, key)}.`
        );
      }
    }
  }
}

function coerceCustomAnswer(
  question: Extract<IntakeFormQuestion, { kind: 'custom' }>,
  value: unknown
): unknown {
  switch (question.type) {
    case 'short_text':
      return boundedText(value, question.label, 200);
    case 'long_text':
      return boundedText(value, question.label, 5000);
    case 'email': {
      const email = boundedText(value, question.label, 200);
      if (!EMAIL_RE.test(email)) {
        throw new ValidationError(`Enter a valid email for ${question.label}.`);
      }
      return email;
    }
    case 'phone': {
      const phone = boundedText(value, question.label, 40);
      if (!validPhone(phone)) {
        throw new ValidationError(
          `Enter a valid phone number for ${question.label}.`
        );
      }
      return phone;
    }
    case 'number': {
      const parsed =
        typeof value === 'number' ? value : Number(String(value).trim());
      if (!Number.isFinite(parsed)) {
        throw new ValidationError(`${question.label} must be a number.`);
      }
      return parsed;
    }
    case 'date': {
      const date = boundedText(value, question.label, 40);
      if (!DATE_RE.test(date)) {
        throw new ValidationError(`${question.label} must be a date.`);
      }
      return date;
    }
    case 'yes_no':
      return coerceBoolean(value);
    case 'single_select':
    case 'radio': {
      const choice = boundedText(value, question.label, 80);
      if (!question.options.includes(choice)) {
        throw new ValidationError(
          `Choose a valid option for ${question.label}.`
        );
      }
      return choice;
    }
    case 'image': {
      const assetId = boundedText(value, question.label, 36);
      if (!IMAGE_ID_RE.test(assetId)) {
        throw new ValidationError(`Upload an image for ${question.label}.`);
      }
      return assetId;
    }
    case 'multi_select': {
      if (!Array.isArray(value) || value.length === 0) {
        throw new ValidationError(
          `Choose at least one option for ${question.label}.`
        );
      }
      const choices = value.map((item) =>
        boundedText(item, question.label, 80)
      );
      if (choices.some((choice) => !question.options.includes(choice))) {
        throw new ValidationError(
          `Choose a valid option for ${question.label}.`
        );
      }
      return choices;
    }
    default:
      throw new ValidationError(
        `"${question.label}" has an answer type this form cannot store.`
      );
  }
}

function boundedText(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new ValidationError(`${label} must be text.`);
  }
  const trimmed = String(value).trim();
  if (!trimmed) throw new ValidationError(`${label} is required.`);
  if (trimmed.length > max) {
    throw new ValidationError(`${label} must be ${max} characters or fewer.`);
  }
  return trimmed;
}

function coerceBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  }
  throw new ValidationError('Choose yes or no.');
}

function coerceBabyCount(value: unknown): number {
  if (typeof value === 'number' && value >= 1 && value <= 4) return value;
  if (typeof value === 'string' && BABY_COUNTS[value.trim()]) {
    return BABY_COUNTS[value.trim()];
  }
  throw new ValidationError('Choose how many babies you are expecting.');
}

function validPhone(value: unknown): boolean {
  return PHONE_RE.test(String(value).replace(/[\s\-()]/g, ''));
}

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function nonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function labelFor(byKey: Map<string, IntakeFormQuestion>, key: string): string {
  return byKey.get(key)?.label ?? key;
}

function labelMessage(
  byKey: Map<string, IntakeFormQuestion>,
  key: string,
  message: string
): string {
  return message.replace(key, labelFor(byKey, key));
}
