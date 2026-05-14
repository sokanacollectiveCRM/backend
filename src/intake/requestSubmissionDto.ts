import { ProviderType } from '../types';

/** CRM label aligned with `PAYMENT_METHOD_OPTIONS` in frontend `useRequestForm.ts`. */
const PAYMENT_METHOD_NORMALIZATION: Record<string, string> = {
  'Private/Commercial Insurance': 'Commercial Insurance',
};

const PROVIDER_TYPE_ALIASES: Record<string, string> = {
  'Family Doctor': 'Family Physician',
};

const ALLOWED_PROVIDER_LABELS = new Set<string>(Object.values(ProviderType));

/**
 * Map CRM payment labels to backend `RequestFormService.newForm` allowlist values.
 */
export function normalizeIntakePaymentMethod(trimmedPaymentMethod: string): string {
  return PAYMENT_METHOD_NORMALIZATION[trimmedPaymentMethod] ?? trimmedPaymentMethod;
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
