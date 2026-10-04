import { DoulaAssignmentRole } from '../domain/assignment';

export interface SavedDoulaAssignment {
  id: string;
  clientId: string;
  doulaId: string;
  services: string[];
  assignedAt: Date | null;
  assignedBy?: string;
  notes?: string;
  role?: DoulaAssignmentRole | null;
  status: 'active';
}

export interface MatchingDoulaRecord {
  id: string;
  fullName: string;
  email: string | null;
}

export interface ClientAssignDeps {
  assignmentExists(clientId: string, doulaId: string): Promise<boolean>;
  getCurrentAvailabilityStatus(doulaId: string): Promise<{
    status: string;
    reason?: string | null;
    startAt?: string | null;
    endAt?: string | null;
  }>;
  assertDoulaAvailableForPeriod(
    doulaId: string,
    start: Date,
    end: Date
  ): Promise<void>;
  assignDoula(
    clientId: string,
    doulaId: string,
    assignedBy?: string,
    notes?: string,
    role?: DoulaAssignmentRole,
    services?: string[]
  ): Promise<SavedDoulaAssignment>;
}

export interface AdminMatchDeps<TClient extends { status: string }> {
  findClient(clientId: string): Promise<TClient | null>;
  getDoulaById(doulaId: string): Promise<MatchingDoulaRecord | null>;
  assignmentExists(clientId: string, doulaId: string): Promise<boolean>;
  assignDoula(
    clientId: string,
    doulaId: string,
    assignedBy?: string,
    notes?: string,
    role?: DoulaAssignmentRole,
    services?: string[]
  ): Promise<SavedDoulaAssignment>;
}
