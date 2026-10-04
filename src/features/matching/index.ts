/**
 * Public matching feature API.
 * Cross-feature consumers should import from this barrel only.
 */

export {
  ASSIGNMENT_SERVICE_CATALOG,
  CLIENT_ASSIGN_SERVICES_ERROR,
  ADMIN_MATCH_SERVICES_ERROR,
  INVALID_ASSIGNMENT_ROLE_ERROR,
  ASSIGNMENT_WINDOW_PAIR_ERROR,
  ALREADY_ASSIGNED_ERROR,
  MATCHING_PHASE_STATUS,
  normalizeAssignmentServices,
  normalizeDoulaAssignmentRole,
  readClientAssignmentWindow,
  currentUnavailabilityMessage,
  clientNotInMatchingPhaseMessage,
} from './domain/assignment';
export type {
  DoulaAssignmentRole,
  AssignmentWindow,
} from './domain/assignment';

export type {
  SavedDoulaAssignment,
  MatchingDoulaRecord,
  ClientAssignDeps,
  AdminMatchDeps,
} from './application/ports';
export { assignDoulaOnClient } from './application/assignDoulaOnClient';
export type {
  ClientAssignInput,
  ClientAssignResult,
} from './application/assignDoulaOnClient';
export { matchDoulaForAdmin } from './application/matchDoulaForAdmin';
export type {
  AdminMatchInput,
  AdminMatchResult,
} from './application/matchDoulaForAdmin';
