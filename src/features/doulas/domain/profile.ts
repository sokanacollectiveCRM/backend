import { ValidationError } from '../../../domains/errors';

export interface Certification {
  name: string;
  issuingOrganization: string;
  expiration_date: string | null;
  no_expiration: boolean;
  /** Retained only for historical data; never rendered or edited. */
  year?: string;
}

export function isValidExpirationDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    value.slice(0, 4) !== '0000' &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}

export function serializeCertifications(
  value: Certification[] | null | undefined
): Certification[] {
  return (value ?? [])
    .filter((entry) => entry.name?.trim())
    .map((entry) => ({
      ...entry,
      expiration_date: entry.expiration_date ?? null,
      no_expiration: entry.no_expiration === true,
    }));
}

export function validateCertifications(value: unknown): Certification[] {
  if (!Array.isArray(value)) {
    throw new ValidationError(
      'Certifications must be a list of at most 20 items.'
    );
  }
  const result: Certification[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new ValidationError('Each certification must be an object.');
    }
    for (const key of ['name', 'issuingOrganization'] as const) {
      if (typeof item[key] !== 'string' || item[key].trim().length > 120) {
        throw new ValidationError(
          'Certification fields must be text of 120 characters or fewer.'
        );
      }
    }
    const name = item.name.trim();
    const issuingOrganization = item.issuingOrganization.trim();
    const expiration_date =
      item.expiration_date === '' || item.expiration_date == null
        ? null
        : item.expiration_date;
    // A blank add row is never persisted, even if No expiration was toggled.
    if (!name && !issuingOrganization && expiration_date === null) continue;
    if (!name) throw new ValidationError('Certification name is required.');
    if (
      expiration_date !== null &&
      (typeof expiration_date !== 'string' ||
        !isValidExpirationDate(expiration_date))
    ) {
      throw new ValidationError(
        'Certification expiration date must be a valid date (YYYY-MM-DD).'
      );
    }
    if (
      item.no_expiration !== undefined &&
      typeof item.no_expiration !== 'boolean'
    ) {
      throw new ValidationError('No expiration must be true or false.');
    }
    const no_expiration = item.no_expiration === true;
    if (no_expiration && expiration_date !== null) {
      throw new ValidationError(
        'A certification with no expiration cannot have an expiration date.'
      );
    }
    const entry: Certification = {
      name,
      issuingOrganization,
      expiration_date,
      no_expiration,
    };
    // Accept historical year values from older clients without ever deriving an expiration.
    if (item.year !== undefined) {
      if (typeof item.year !== 'string' || item.year.trim().length > 120) {
        throw new ValidationError('Legacy certification year must be text.');
      }
      entry.year = item.year.trim();
    }
    result.push(entry);
  }
  if (result.length > 20) {
    throw new ValidationError(
      'Certifications must be a list of at most 20 items.'
    );
  }
  return result;
}

export function isValidPhone(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^(?:[0-9]{10}|[0-9]{3}-[0-9]{3}-[0-9]{4})$/.test(value)
  );
}

export function normalizePhone(value: unknown): string {
  if (!isValidPhone(value))
    throw new ValidationError('Enter a 10-digit phone number');
  return value.replace(/-/g, '');
}

export const PROFILE_REQUIRED_FIELDS = [
  'firstname',
  'lastname',
  'address',
  'city',
  'state',
  'country',
  'zip_code',
  'bio',
] as const;
export function missingProfileFields(
  profile: Record<string, unknown>
): string[] {
  const missing: string[] = PROFILE_REQUIRED_FIELDS.filter(
    (key) => !String(profile[key] ?? '').trim()
  );
  if (!isValidPhone(profile.phone ?? profile.phone_number))
    missing.push('phone_number');
  return missing;
}
