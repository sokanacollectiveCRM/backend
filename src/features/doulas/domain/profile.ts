import { ValidationError } from '../../../domains/errors';

export interface Certification {
  name: string;
  issuingOrganization: string;
  year: string;
}

export function validateCertifications(value: unknown): Certification[] {
  if (!Array.isArray(value) || value.length > 20) {
    throw new ValidationError(
      'Certifications must be a list of at most 20 items.'
    );
  }
  return value.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new ValidationError(
        'Each certification must include a name, issuing organization, and year.'
      );
    }
    const result = {} as Certification;
    for (const key of ['name', 'issuingOrganization', 'year'] as const) {
      if (typeof item[key] !== 'string' || item[key].trim().length > 120) {
        throw new ValidationError(
          'Certification fields must be text of 120 characters or fewer.'
        );
      }
      result[key] = item[key].trim();
    }
    if (!result.name)
      throw new ValidationError('Certification name is required.');
    return result;
  });
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
  return PROFILE_REQUIRED_FIELDS.filter(
    (key) => !String(profile[key] ?? '').trim()
  );
}
