import { ValidationError } from '../domains/errors';

/** Must match Sokana CRM intake (Step 4). */
export const ALLOWED_REFERRAL_SOURCES = [
  'Google',
  'Doula Match',
  'Former client',
  'Sokana Member',
  'Social Media',
  'Email Blast',
  'Other',
] as const;

export type AllowedReferralSource = (typeof ALLOWED_REFERRAL_SOURCES)[number];

const ALLOWED_SET = new Set<string>(ALLOWED_REFERRAL_SOURCES);

export const REFERRAL_SOURCE_OTHER_REQUIRED_MESSAGE =
  'Please describe how you heard about Sokana.';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function trimToNull(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

/**
 * Validates public intake referral fields. `referral_source` is required.
 * When source is `Other`, `referral_source_other` must be non-empty after trim.
 * Otherwise `referral_source_other` is cleared (null).
 */
export function parseIntakeReferral(form: {
  referral_source?: unknown;
  referral_name?: unknown;
  referral_email?: unknown;
  referral_source_other?: unknown;
}): {
  referral_source: string;
  referral_name: string | null;
  referral_email: string | null;
  referral_source_other: string | null;
} {
  const srcRaw = form.referral_source;
  if (typeof srcRaw !== 'string' || !srcRaw.trim()) {
    throw new ValidationError('referral_source is required');
  }
  const referral_source = srcRaw.trim();
  if (!ALLOWED_SET.has(referral_source)) {
    throw new ValidationError(
      `referral_source must be one of: ${ALLOWED_REFERRAL_SOURCES.join(', ')}`
    );
  }

  const referral_name = trimToNull(form.referral_name);

  const emailRaw = trimToNull(form.referral_email);
  if (emailRaw && !EMAIL_RE.test(emailRaw)) {
    throw new ValidationError('referral_email must be a valid email address');
  }
  const referral_email = emailRaw;

  let referral_source_other = trimToNull(form.referral_source_other);
  if (referral_source === 'Other') {
    if (!referral_source_other) {
      throw new ValidationError(REFERRAL_SOURCE_OTHER_REQUIRED_MESSAGE);
    }
  } else {
    referral_source_other = null;
  }

  return { referral_source, referral_name, referral_email, referral_source_other };
}

export type ReferralCurrent = {
  referral_source?: string | null;
  referral_name?: string | null;
  referral_email?: string | null;
  referral_source_other?: string | null;
};

/**
 * Staff CRM PATCH: enforce enum, Other + text, email format, and clear
 * `referral_source_other` when `referral_source` is not `Other`.
 * Mutates a shallow copy of `operational` keys only for referral fields.
 */
export function normalizeStaffReferralOperationalPatch(
  operational: Record<string, unknown>,
  current: ReferralCurrent
): { ok: true; operational: Record<string, unknown> } | { ok: false; message: string } {
  const keys = ['referral_source', 'referral_source_other', 'referral_name', 'referral_email'];
  if (!keys.some((k) => Object.prototype.hasOwnProperty.call(operational, k))) {
    return { ok: true, operational };
  }

  const out = { ...operational };

  const mergedSource =
    Object.prototype.hasOwnProperty.call(out, 'referral_source')
      ? trimToNull(out.referral_source)
      : trimToNull(current.referral_source ?? undefined);

  if (Object.prototype.hasOwnProperty.call(out, 'referral_source')) {
    if (!mergedSource) {
      return { ok: false, message: 'referral_source cannot be empty' };
    }
    if (!ALLOWED_SET.has(mergedSource)) {
      return {
        ok: false,
        message: `referral_source must be one of: ${ALLOWED_REFERRAL_SOURCES.join(', ')}`,
      };
    }
    out.referral_source = mergedSource;
  }

  const sourceForOtherRules = mergedSource || '';

  if (Object.prototype.hasOwnProperty.call(out, 'referral_name')) {
    out.referral_name = trimToNull(out.referral_name);
  }

  if (Object.prototype.hasOwnProperty.call(out, 'referral_email')) {
    const e = trimToNull(out.referral_email);
    if (e && !EMAIL_RE.test(e)) {
      return { ok: false, message: 'referral_email must be a valid email address' };
    }
    out.referral_email = e;
  }

  const mergedOtherExplicit = Object.prototype.hasOwnProperty.call(out, 'referral_source_other');
  const mergedOtherValue = mergedOtherExplicit
    ? trimToNull(out.referral_source_other)
    : trimToNull(current.referral_source_other ?? undefined);

  if (sourceForOtherRules === 'Other') {
    if (!mergedOtherValue) {
      return { ok: false, message: REFERRAL_SOURCE_OTHER_REQUIRED_MESSAGE };
    }
    out.referral_source_other = mergedOtherValue;
  } else {
    out.referral_source_other = null;
  }

  return { ok: true, operational: out };
}
