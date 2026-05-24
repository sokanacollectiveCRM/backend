import { ProviderType } from '../types';

/** CRM labels on the public request form (Medicaid hidden in UI). */
export const INTAKE_PAYMENT_METHOD_OPTIONS = [
  'Private/Commercial Insurance',
  'Self-Pay, Sliding Scale Available',
  'I am unable to pay / Full Support Option',
  'Not sure / Need help figuring this out',
] as const;

export type IntakePaymentMethodOption = (typeof INTAKE_PAYMENT_METHOD_OPTIONS)[number];

const INTAKE_PAYMENT_METHOD_SET = new Set<string>(INTAKE_PAYMENT_METHOD_OPTIONS);

/** Values stored on `phi_clients.payment_method` after intake normalization. */
const PAYMENT_METHOD_NORMALIZATION: Record<IntakePaymentMethodOption, string> = {
  'Private/Commercial Insurance': 'Commercial Insurance',
  'Self-Pay, Sliding Scale Available': 'Self-Pay, Sliding Scale Available',
  'I am unable to pay / Full Support Option': 'I am unable to pay / Full Support Option',
  'Not sure / Need help figuring this out': 'Not sure / Need help figuring this out',
};

export const ALLOWED_INTAKE_BIRTH_LOCATIONS = new Set([
  'Hospital',
  'Home',
  'Birth Center',
  'Other',
]);

const PROVIDER_TYPE_ALIASES: Record<string, string> = {
  'Family Doctor': 'Family Physician',
};

const ALLOWED_PROVIDER_LABELS = new Set<string>(Object.values(ProviderType));

/**
 * Suggested validation message when `birth_hospital` is missing (parity with frontend).
 */
export function getBirthLocationPlaceError(birthLocation: string): string {
  switch (birthLocation) {
    case 'Home':
      return 'Please enter your home birth location (e.g. home address).';
    case 'Hospital':
      return 'Please enter the hospital name.';
    case 'Birth Center':
      return 'Please enter the birth center name or location.';
    case 'Other':
      return 'Please enter your birth location name.';
    default:
      return 'Please enter your birth location name.';
  }
}

/**
 * Validates intake birth type + place name (`birth_hospital` is not hospital-only).
 */
export function validateIntakeBirthPlace(
  birthLocationRaw: unknown,
  birthHospitalRaw: unknown
): { ok: true; birth_location: string; birth_hospital: string } | { ok: false; message: string } {
  const birth_location =
    typeof birthLocationRaw === 'string' ? birthLocationRaw.trim() : '';
  if (!birth_location) {
    return { ok: false, message: 'birth_location is required' };
  }
  if (!ALLOWED_INTAKE_BIRTH_LOCATIONS.has(birth_location)) {
    return {
      ok: false,
      message: 'birth_location must be one of: Hospital, Home, Birth Center, Other',
    };
  }

  const birth_hospital =
    typeof birthHospitalRaw === 'string' ? birthHospitalRaw.trim() : '';
  if (!birth_hospital) {
    return { ok: false, message: getBirthLocationPlaceError(birth_location) };
  }

  return { ok: true, birth_location, birth_hospital };
}

/**
 * Public intake payment method: accept four CRM labels, reject Medicaid, map for persistence.
 */
export function parseIntakePaymentMethod(
  raw: unknown
): { ok: true; value: string; requiresInsurance: boolean } | { ok: false; message: string } {
  if (typeof raw !== 'string') {
    return { ok: false, message: 'payment_method is required' };
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, message: 'payment_method is required' };
  }
  if (trimmed.toLowerCase() === 'medicaid') {
    return {
      ok: false,
      message:
        'Medicaid is not accepted on the public request form; choose another payment option or contact the office',
    };
  }
  if (!INTAKE_PAYMENT_METHOD_SET.has(trimmed)) {
    return {
      ok: false,
      message: `payment_method must be one of: ${INTAKE_PAYMENT_METHOD_OPTIONS.join(', ')}`,
    };
  }
  const value = PAYMENT_METHOD_NORMALIZATION[trimmed as IntakePaymentMethodOption];
  const requiresInsurance = value === 'Commercial Insurance';
  return { ok: true, value, requiresInsurance };
}

/**
 * @deprecated Use {@link parseIntakePaymentMethod} for intake; kept for unit tests of label mapping.
 */
export function normalizeIntakePaymentMethod(trimmedPaymentMethod: string): string {
  const parsed = parseIntakePaymentMethod(trimmedPaymentMethod);
  if (parsed.ok) {
    return parsed.value;
  }
  return trimmedPaymentMethod;
}

/**
 * Client age in whole years (CRM `useRequestForm`: 1–120 inclusive).
 */
export function parseIntakeClientAgeYears(
  raw: unknown
): { ok: true; value: number } | { ok: false; message: string } {
  if (raw === undefined || raw === null) {
    return { ok: false, message: 'age is required' };
  }
  let n: number;
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || !Number.isInteger(raw)) {
      return { ok: false, message: 'age must be a whole number between 1 and 120' };
    }
    n = raw;
  } else if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t) {
      return { ok: false, message: 'age is required' };
    }
    if (!/^\d+$/.test(t)) {
      return { ok: false, message: 'age must be a whole number between 1 and 120' };
    }
    n = parseInt(t, 10);
  } else {
    return { ok: false, message: 'age must be a number or numeric string' };
  }
  if (n < 1 || n > 120) {
    return { ok: false, message: 'age must be between 1 and 120' };
  }
  return { ok: true, value: n };
}

/**
 * Pregnancy care provider; accepts CRM copy such as "Family Doctor" → `Family Physician`.
 */
export function parseIntakeProviderType(
  raw: unknown
): { ok: true; value: ProviderType } | { ok: false; message: string } {
  if (typeof raw !== 'string') {
    return { ok: false, message: 'provider_type is required' };
  }
  const t = raw.trim();
  if (!t) {
    return { ok: false, message: 'provider_type is required' };
  }
  const normalized = PROVIDER_TYPE_ALIASES[t] ?? t;
  if (!ALLOWED_PROVIDER_LABELS.has(normalized)) {
    const allowed = [...ALLOWED_PROVIDER_LABELS].sort().join(', ');
    return { ok: false, message: `provider_type must be one of: ${allowed}` };
  }
  return { ok: true, value: normalized as ProviderType };
}
