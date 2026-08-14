/**
 * Canonical HTTP envelope helpers (PR 7).
 * Prefer additive migration: keep legacy shapes where FE depends on them
 * (login, /auth/me, /health) and use these builders for newly migrated routes.
 */

import { ApiResponse, ApiErrorResponse, ApiSuccessResponse } from '../../utils/responseBuilder';
import { ApiErrorCode, ApiErrorCodeName } from '../../security/errorCodes';

export { ApiResponse };
export type { ApiErrorResponse, ApiSuccessResponse };

/** Canonical error body used by migrated routes. */
export function canonicalError(
  message: string,
  code: ApiErrorCodeName = ApiErrorCode.INTERNAL_ERROR,
): ApiErrorResponse {
  return ApiResponse.error(message, code);
}

/** Canonical success body used by migrated routes. */
export function canonicalOk<T>(data: T, meta?: Record<string, unknown>): ApiSuccessResponse<T> {
  return ApiResponse.success(data, meta);
}

/**
 * Auth-compatible error body: preserves historical `error` (+ optional `hint`)
 * and adds machine-readable `code` without requiring `success: false`.
 */
export function authErrorBody(
  message: string,
  code: ApiErrorCodeName,
  extras: { hint?: string } = {},
): { error: string; code: string; hint?: string } {
  return {
    error: message,
    code,
    ...(extras.hint ? { hint: extras.hint } : {}),
  };
}

/** Validation failure body — keeps string `error` for FE normalizeError / login. */
export function validationErrorBody(
  message: string = 'Invalid request data',
  details?: unknown,
): {
  success: false;
  error: string;
  code: typeof ApiErrorCode.VALIDATION_ERROR;
  details?: unknown;
} {
  return {
    success: false,
    error: message,
    code: ApiErrorCode.VALIDATION_ERROR,
    ...(details !== undefined ? { details } : {}),
  };
}
