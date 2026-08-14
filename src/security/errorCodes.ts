/**
 * Stable machine-readable API error codes (PR 7).
 * Additive — existing `error` string messages remain the primary client-facing field.
 */

export const ApiErrorCode = {
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
} as const;

export type ApiErrorCodeName = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];
