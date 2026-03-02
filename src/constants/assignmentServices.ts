import { ServiceTypes } from '../types';

export const ASSIGNMENT_SERVICE_CATALOG: readonly string[] = Object.freeze([
  ServiceTypes.LABOR_SUPPORT,
  ServiceTypes.POSTPARTUM_SUPPORT,
  ServiceTypes.PERINATAL_EDUCATION,
  ServiceTypes.FIRST_NIGHT,
  ServiceTypes.LACTATION_SUPPORT,
  ServiceTypes.PHOTOGRAPHY,
  ServiceTypes.OTHER,
  'Extended Postpartum Support',
]);

const ASSIGNMENT_SERVICE_SET = new Set(
  ASSIGNMENT_SERVICE_CATALOG.map((service) => service.toLowerCase())
);

export const normalizeAssignmentServices = (raw: unknown): string[] | null => {
  if (!Array.isArray(raw)) {
    return null;
  }

  const normalized = raw
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter((value) => value.length > 0);

  if (normalized.length === 0) {
    return null;
  }

  const deduped = [...new Set(normalized)];
  const allValid = deduped.every((service) =>
    ASSIGNMENT_SERVICE_SET.has(service.toLowerCase())
  );

  return allValid ? deduped : null;
};
