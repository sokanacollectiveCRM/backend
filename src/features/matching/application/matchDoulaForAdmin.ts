import {
  ADMIN_MATCH_SERVICES_ERROR,
  ALREADY_ASSIGNED_ERROR,
  INVALID_ASSIGNMENT_ROLE_ERROR,
  MATCHING_PHASE_STATUS,
  clientNotInMatchingPhaseMessage,
  normalizeAssignmentServices,
  normalizeDoulaAssignmentRole,
} from '../domain/assignment';
import {
  AdminMatchDeps,
  MatchingDoulaRecord,
  SavedDoulaAssignment,
} from './ports';

export type AdminMatchResult<TClient extends { status: string }> =
  | { ok: false; status: 400 | 404; body: { success: false; error: string } }
  | {
      ok: true;
      clientId: string;
      doulaId: string;
      notes: unknown;
      assignment: SavedDoulaAssignment;
      client: TClient;
      doula: MatchingDoulaRecord;
    };

export interface AdminMatchInput {
  clientId?: unknown;
  doulaId?: unknown;
  notes: unknown;
  role: unknown;
  services: unknown;
  assignedBy?: string;
}

/**
 * Admin route `POST /admin/assignments/match`.
 * Requires the client status `matching` and an existing doula row.
 * Does not check availability. An existing active assignment is 400.
 */
export async function matchDoulaForAdmin<TClient extends { status: string }>(
  deps: AdminMatchDeps<TClient>,
  input: AdminMatchInput
): Promise<AdminMatchResult<TClient>> {
  const { clientId, doulaId } = input;
  if (!clientId || !doulaId) {
    return {
      ok: false,
      status: 400,
      body: {
        success: false,
        error: 'Missing required fields: clientId and doulaId are required',
      },
    };
  }

  const role =
    input.role === undefined
      ? undefined
      : normalizeDoulaAssignmentRole(input.role);
  if (input.role !== undefined && !role) {
    return {
      ok: false,
      status: 400,
      body: { success: false, error: INVALID_ASSIGNMENT_ROLE_ERROR },
    };
  }

  const services = normalizeAssignmentServices(input.services);
  if (!services) {
    return {
      ok: false,
      status: 400,
      body: { success: false, error: ADMIN_MATCH_SERVICES_ERROR },
    };
  }

  const clientKey = clientId as string;
  const doulaKey = doulaId as string;

  const client = await deps.findClient(clientKey);
  if (!client) {
    return {
      ok: false,
      status: 404,
      body: { success: false, error: 'Client not found' },
    };
  }

  if (client.status !== MATCHING_PHASE_STATUS) {
    return {
      ok: false,
      status: 400,
      body: {
        success: false,
        error: clientNotInMatchingPhaseMessage(client.status),
      },
    };
  }

  const doula = await deps.getDoulaById(doulaKey);
  if (!doula) {
    return {
      ok: false,
      status: 404,
      body: { success: false, error: 'Doula not found' },
    };
  }

  if (await deps.assignmentExists(clientKey, doulaKey)) {
    return {
      ok: false,
      status: 400,
      body: { success: false, error: ALREADY_ASSIGNED_ERROR },
    };
  }

  const assignment = await deps.assignDoula(
    clientKey,
    doulaKey,
    input.assignedBy,
    typeof input.notes === 'string' ? input.notes : undefined,
    role,
    services
  );

  return {
    ok: true,
    clientId: clientKey,
    doulaId: doulaKey,
    notes: input.notes,
    assignment,
    client,
    doula,
  };
}
