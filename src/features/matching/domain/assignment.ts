/**
 * Doula assignment rules shared by the client assign route and the admin
 * match route. The two routes keep their own error text and status codes.
 */

export type DoulaAssignmentRole = 'primary' | 'backup';

export const MATCHING_PHASE_STATUS = 'matching';

export const ASSIGNMENT_SERVICE_CATALOG: readonly string[] = Object.freeze([
  'Labor Support',
  'Postpartum Support',
  'Perinatal Education',
  'First Night Care',
  'Lactation Support',
  'Photography',
  'Other',
  'Extended Postpartum Support',
]);

const ASSIGNMENT_SERVICE_SET = new Set(
  ASSIGNMENT_SERVICE_CATALOG.map((service) => service.toLowerCase())
);

export const CLIENT_ASSIGN_SERVICES_ERROR = `services is required and must contain one or more valid values: ${ASSIGNMENT_SERVICE_CATALOG.join(', ')}`;

export const ADMIN_MATCH_SERVICES_ERROR = `services is required and must include one or more values from: ${ASSIGNMENT_SERVICE_CATALOG.join(', ')}`;

export const INVALID_ASSIGNMENT_ROLE_ERROR =
  "Invalid role. Allowed values are 'primary' or 'backup'";

export const ASSIGNMENT_WINDOW_PAIR_ERROR =
  'assignmentStart and assignmentEnd must be provided together';

export const ALREADY_ASSIGNED_ERROR =
  'This doula is already assigned to this client';

export function normalizeAssignmentServices(raw: unknown): string[] | null {
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
}

export function normalizeDoulaAssignmentRole(
  raw: unknown
): DoulaAssignmentRole | null {
  if (typeof raw !== 'string') return null;
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'primary' || normalized === 'backup') {
    return normalized;
  }
  return null;
}

export type AssignmentWindow =
  | { kind: 'absent' }
  | { kind: 'incomplete' }
  | { kind: 'present'; start: Date; end: Date };

/** Reads the client-route window aliases. A value is present when it is truthy. */
export function readClientAssignmentWindow(
  body: Record<string, unknown> | null | undefined
): AssignmentWindow {
  const start =
    body?.assignmentStart ??
    body?.assignment_start ??
    body?.requestedStart ??
    body?.requested_start;
  const end =
    body?.assignmentEnd ??
    body?.assignment_end ??
    body?.requestedEnd ??
    body?.requested_end;

  if ((start && !end) || (!start && end)) {
    return { kind: 'incomplete' };
  }
  if (!start || !end) {
    return { kind: 'absent' };
  }
  return {
    kind: 'present',
    start: new Date(start as string | number),
    end: new Date(end as string | number),
  };
}

export function currentUnavailabilityMessage(availability: {
  reason?: string | null;
  startAt?: string | null;
  endAt?: string | null;
}): string {
  const reason = availability.reason ? ` (${availability.reason})` : '';
  return `Doula is currently unavailable${reason}. Unavailable from ${availability.startAt} to ${availability.endAt}.`;
}

export function clientNotInMatchingPhaseMessage(status: string): string {
  return `Client is not in matching phase. Current status: ${status}. Only clients with status 'matching' can be assigned to doulas.`;
}
