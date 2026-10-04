import {
  ALREADY_ASSIGNED_ERROR,
  ASSIGNMENT_WINDOW_PAIR_ERROR,
  CLIENT_ASSIGN_SERVICES_ERROR,
  INVALID_ASSIGNMENT_ROLE_ERROR,
  currentUnavailabilityMessage,
  normalizeAssignmentServices,
  normalizeDoulaAssignmentRole,
  readClientAssignmentWindow,
} from '../domain/assignment';
import { ClientAssignDeps, SavedDoulaAssignment } from './ports';

export type ClientAssignResult =
  | { ok: false; status: 400 | 409; error: string }
  | { ok: true; assignment: SavedDoulaAssignment };

export interface ClientAssignInput {
  clientId?: string;
  doulaId?: unknown;
  role: unknown;
  services: unknown;
  body: Record<string, unknown> | undefined;
  assignedBy?: string;
}

/**
 * Client route `POST /clients/:id/assign-doula`.
 * Blocks on current unavailability and on an overlapping assignment window.
 * An existing active assignment is 409.
 */
export async function assignDoulaOnClient(
  deps: ClientAssignDeps,
  input: ClientAssignInput
): Promise<ClientAssignResult> {
  const { clientId, doulaId } = input;
  if (!clientId || !doulaId) {
    return { ok: false, status: 400, error: 'Missing clientId or doulaId' };
  }

  const services = normalizeAssignmentServices(input.services);
  if (!services) {
    return { ok: false, status: 400, error: CLIENT_ASSIGN_SERVICES_ERROR };
  }

  const role =
    input.role === undefined
      ? undefined
      : normalizeDoulaAssignmentRole(input.role);
  if (input.role !== undefined && !role) {
    return { ok: false, status: 400, error: INVALID_ASSIGNMENT_ROLE_ERROR };
  }

  const doula = doulaId as string;
  if (await deps.assignmentExists(clientId, doula)) {
    return { ok: false, status: 409, error: ALREADY_ASSIGNED_ERROR };
  }

  const current = await deps.getCurrentAvailabilityStatus(doula);
  if (current.status === 'unavailable') {
    return {
      ok: false,
      status: 409,
      error: currentUnavailabilityMessage(current),
    };
  }

  const window = readClientAssignmentWindow(input.body);
  if (window.kind === 'incomplete') {
    return { ok: false, status: 400, error: ASSIGNMENT_WINDOW_PAIR_ERROR };
  }
  if (window.kind === 'present') {
    await deps.assertDoulaAvailableForPeriod(doula, window.start, window.end);
  }

  const assignment = await deps.assignDoula(
    clientId,
    doula,
    input.assignedBy,
    undefined,
    role,
    services
  );
  return { ok: true, assignment };
}
