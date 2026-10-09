import { ProviderType } from '../../../types';

/** CRM labels on the public request form (Medicaid hidden in UI). */
export const INTAKE_PAYMENT_METHOD_OPTIONS = [
  'Private/Commercial Insurance',
  'Self-Pay, Sliding Scale Available',
  'I am unable to pay / Full Support Option',
  'Not sure / Need help figuring this out',
] as const;

export type IntakePaymentMethodOption =
  (typeof INTAKE_PAYMENT_METHOD_OPTIONS)[number];

const INTAKE_PAYMENT_METHOD_SET = new Set<string>(
  INTAKE_PAYMENT_METHOD_OPTIONS
);

/** Values stored on `phi_clients.payment_method` after intake normalization. */
const PAYMENT_METHOD_NORMALIZATION: Record<IntakePaymentMethodOption, string> =
  {
    'Private/Commercial Insurance': 'Commercial Insurance',
    'Self-Pay, Sliding Scale Available': 'Self-Pay, Sliding Scale Available',
    'I am unable to pay / Full Support Option':
      'I am unable to pay / Full Support Option',
    'Not sure / Need help figuring this out':
      'Not sure / Need help figuring this out',
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
 * Both are optional on public intake (Nancy 2026-10-09). If a location is sent,
 * it must be one of the allowed labels; place name is not hard-required.
 */
export function validateIntakeBirthPlace(
  birthLocationRaw: unknown,
  birthHospitalRaw: unknown
):
  | {
      ok: true;
      birth_location: string | null;
      birth_hospital: string | null;
    }
  | { ok: false; message: string } {
  const birth_location =
    typeof birthLocationRaw === 'string' ? birthLocationRaw.trim() : '';
  const birth_hospital =
    typeof birthHospitalRaw === 'string' ? birthHospitalRaw.trim() : '';

  if (!birth_location) {
    return {
      ok: true,
      birth_location: null,
      birth_hospital: birth_hospital || null,
    };
  }
  if (!ALLOWED_INTAKE_BIRTH_LOCATIONS.has(birth_location)) {
    return {
      ok: false,
      message:
        'birth_location must be one of: Hospital, Home, Birth Center, Other',
    };
  }

  return {
    ok: true,
    birth_location,
    birth_hospital: birth_hospital || null,
  };
}

/**
 * Public intake payment method: accept four CRM labels, reject Medicaid, map for persistence.
 * Omitted/blank is allowed (Nancy 2026-10-09).
 */
export function parseIntakePaymentMethod(
  raw: unknown
):
  | { ok: true; value: string | null; requiresInsurance: boolean }
  | { ok: false; message: string } {
  if (raw === undefined || raw === null) {
    return { ok: true, value: null, requiresInsurance: false };
  }
  if (typeof raw !== 'string') {
    return { ok: false, message: 'payment_method must be a string' };
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: true, value: null, requiresInsurance: false };
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
  const value =
    PAYMENT_METHOD_NORMALIZATION[trimmed as IntakePaymentMethodOption];
  const requiresInsurance = value === 'Commercial Insurance';
  return { ok: true, value, requiresInsurance };
}

/**
 * @deprecated Use {@link parseIntakePaymentMethod} for intake; kept for unit tests of label mapping.
 */
export function normalizeIntakePaymentMethod(
  trimmedPaymentMethod: string
): string {
  const parsed = parseIntakePaymentMethod(trimmedPaymentMethod);
  if (parsed.ok) {
    return parsed.value ?? trimmedPaymentMethod;
  }
  return trimmedPaymentMethod;
}

/**
 * Client age in whole years (CRM `useRequestForm`: 1–120 inclusive).
 * Omitted/blank is allowed (Nancy 2026-10-09).
 */
export function parseIntakeClientAgeYears(
  raw: unknown
): { ok: true; value: number | null } | { ok: false; message: string } {
  if (raw === undefined || raw === null) {
    return { ok: true, value: null };
  }
  let n: number;
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || !Number.isInteger(raw)) {
      return {
        ok: false,
        message: 'age must be a whole number between 1 and 120',
      };
    }
    n = raw;
  } else if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t) {
      return { ok: true, value: null };
    }
    if (!/^\d+$/.test(t)) {
      return {
        ok: false,
        message: 'age must be a whole number between 1 and 120',
      };
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

/** Frontend demographics buckets derived from exact age when provided. */
export const CLIENT_AGE_RANGE_FROM_YEARS = [
  'Under 20',
  '20-25',
  '26-35',
  '36 and older',
] as const;

export type ClientAgeRangeFromYears =
  (typeof CLIENT_AGE_RANGE_FROM_YEARS)[number];

export function clientAgeRangeFromYears(
  age: number
): ClientAgeRangeFromYears | null {
  if (!Number.isFinite(age) || age < 1) return null;
  if (age < 20) return 'Under 20';
  if (age <= 25) return '20-25';
  if (age <= 35) return '26-35';
  return '36 and older';
}

/**
 * Pregnancy care provider; accepts CRM copy such as "Family Doctor" → `Family Physician`.
 * Omitted/blank is allowed (Nancy 2026-10-09).
 */
export function parseIntakeProviderType(
  raw: unknown
): { ok: true; value: ProviderType | null } | { ok: false; message: string } {
  if (raw === undefined || raw === null) {
    return { ok: true, value: null };
  }
  if (typeof raw !== 'string') {
    return { ok: false, message: 'provider_type must be a string' };
  }
  const t = raw.trim();
  if (!t) {
    return { ok: true, value: null };
  }
  const normalized = PROVIDER_TYPE_ALIASES[t] ?? t;
  if (!ALLOWED_PROVIDER_LABELS.has(normalized)) {
    const allowed = [...ALLOWED_PROVIDER_LABELS].sort().join(', ');
    return { ok: false, message: `provider_type must be one of: ${allowed}` };
  }
  return { ok: true, value: normalized as ProviderType };
}

/** CRM home type step — array of checkbox labels; legacy single string accepted. */
export function normalizeIntakeHomeTypes(raw: unknown): string[] | null {
  if (raw === undefined || raw === null) {
    return null;
  }
  if (Array.isArray(raw)) {
    const items = raw
      .map((item) =>
        typeof item === 'string' ? item.trim() : String(item).trim()
      )
      .filter((item) => item.length > 0);
    return items.length > 0 ? items : null;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) {
      return null;
    }
    if (trimmed.startsWith('[')) {
      try {
        return normalizeIntakeHomeTypes(JSON.parse(trimmed) as unknown);
      } catch {
        return [trimmed];
      }
    }
    return [trimmed];
  }
  return null;
}

/** Legacy `home_type` VARCHAR — first selection or joined labels (max 100 chars). */
export function legacyHomeTypeVarchar(
  homeTypes: string[] | null
): string | null {
  if (!homeTypes?.length) {
    return null;
  }
  const joined = homeTypes.join('; ');
  return joined.length > 100 ? joined.slice(0, 100) : joined;
}

export const INTAKE_HOME_PEOPLE_COUNT_OPTIONS = [
  '0',
  '1',
  '2',
  '3',
  '4',
  '5+',
] as const;

export function parseIntakeHomePeopleCount(
  raw: unknown,
  fieldLabel: 'home_adults_count' | 'home_youth_count'
): { ok: true; value: string | null } | { ok: false; message: string } {
  if (raw === undefined || raw === null) {
    return { ok: true, value: null };
  }
  const s =
    typeof raw === 'number'
      ? String(raw)
      : typeof raw === 'string'
        ? raw.trim()
        : '';
  if (!s) {
    return { ok: true, value: null };
  }
  if (!(INTAKE_HOME_PEOPLE_COUNT_OPTIONS as readonly string[]).includes(s)) {
    return {
      ok: false,
      message: `${fieldLabel} must be one of: ${INTAKE_HOME_PEOPLE_COUNT_OPTIONS.join(', ')}`,
    };
  }
  return { ok: true, value: s };
}
