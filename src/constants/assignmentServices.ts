/**
 * Compatibility shim — the assignment service catalog lives in
 * `src/features/matching/domain`. Prefer importing from `src/features/matching`.
 */
export {
  ASSIGNMENT_SERVICE_CATALOG,
  normalizeAssignmentServices,
} from '../features/matching';
