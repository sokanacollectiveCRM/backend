import { isAssignmentsTableMissing } from '../domain/assignmentsTable';

export interface AssignedDoulaRecord {
  id: string;
  doulaId: string;
  services: string[];
  assignedAt: Date | null;
  role?: string | null;
  status: string;
  doula: {
    id: string;
    firstname: string;
    lastname: string;
    email: string;
    phone_number?: string;
    scheduling_url?: string | null;
  };
}

export interface DoulaAvailabilitySnapshot {
  status: 'available' | 'unavailable';
  reason: string | null;
  startAt: string | null;
  endAt: string | null;
}

export interface ListedAssignedDoula extends AssignedDoulaRecord {
  availabilityStatus: DoulaAvailabilitySnapshot;
  doula: AssignedDoulaRecord['doula'] & { scheduling_url: string | null };
}

export type ListAssignedDoulasError =
  | 'MISSING_CLIENT_ID'
  | 'ASSIGNMENTS_UNAVAILABLE';

export type ListAssignedDoulasResult =
  | { ok: true; doulas: ListedAssignedDoula[] }
  | { ok: false; error: ListAssignedDoulasError };

export interface ListAssignedDoulasInput {
  clientId: unknown;
  viewerRole?: string;
}

export interface ListAssignedDoulasDeps {
  getAssignedDoulas(clientId: string): Promise<AssignedDoulaRecord[]>;
  getAvailabilityStatusForDoulas(
    doulaIds: string[]
  ): Promise<Map<string, DoulaAvailabilitySnapshot>>;
  isClientInContractStage(clientId: string): Promise<boolean>;
}

const AVAILABLE: DoulaAvailabilitySnapshot = {
  status: 'available',
  reason: null,
  startAt: null,
  endAt: null,
};

/**
 * Lists active doula assignments for one client and attaches availability.
 * Scheduling links are visible to admins, and to clients already in the
 * contract stage. Authorization stays in HTTP.
 */
export async function listAssignedDoulas(
  deps: ListAssignedDoulasDeps,
  input: ListAssignedDoulasInput
): Promise<ListAssignedDoulasResult> {
  if (!input.clientId) {
    return { ok: false, error: 'MISSING_CLIENT_ID' };
  }

  const clientId = input.clientId as string;
  try {
    const doulas = await deps.getAssignedDoulas(clientId);
    const availabilityByDoulaId = await deps.getAvailabilityStatusForDoulas(
      doulas.map((doula) => doula.doulaId)
    );
    const includeSchedulingLink =
      input.viewerRole === 'admin' ||
      (input.viewerRole === 'client' &&
        (await deps.isClientInContractStage(clientId)));

    return {
      ok: true,
      doulas: doulas.map((assignment) => {
        const availability =
          availabilityByDoulaId.get(assignment.doulaId) ?? AVAILABLE;
        return {
          ...assignment,
          availabilityStatus: availability,
          doula: {
            ...assignment.doula,
            scheduling_url: includeSchedulingLink
              ? (assignment.doula.scheduling_url ?? null)
              : null,
          },
        };
      }),
    };
  } catch (error) {
    if (isAssignmentsTableMissing(error)) {
      return { ok: false, error: 'ASSIGNMENTS_UNAVAILABLE' };
    }
    throw error;
  }
}
