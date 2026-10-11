import { Response } from 'express';

import { SAFE_INTERNAL_ERROR_MESSAGE } from '../../../common/utils/safeLogging';
import { logger } from '../../../common/utils/logger';
import {
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../../domains/errors';
import { ApiErrorCode } from '../../../security/errorCodes';
import { SchedulingConflictError } from '../application/schedulingService';

export function sendSchedulingError(res: Response, error: unknown): void {
  if (error instanceof SchedulingConflictError) {
    res.status(409).json({
      error: error.message,
      code: error.code,
    });
    return;
  }
  if (error instanceof ValidationError) {
    res.status(400).json({
      error: error.message,
      code: ApiErrorCode.VALIDATION_ERROR,
    });
    return;
  }
  if (error instanceof ConflictError) {
    res.status(409).json({
      error: error.message,
      code: ApiErrorCode.CONFLICT,
    });
    return;
  }
  if (error instanceof AuthenticationError) {
    res.status(401).json({
      error: error.message,
      code: ApiErrorCode.UNAUTHENTICATED,
    });
    return;
  }
  if (error instanceof NotFoundError) {
    res.status(404).json({
      error: error.message,
      code: ApiErrorCode.NOT_FOUND,
    });
    return;
  }
  if (error instanceof AuthorizationError) {
    const code =
      (error as AuthorizationError & { code?: string }).code ||
      ApiErrorCode.FORBIDDEN;
    res.status(403).json({
      error: error.message,
      code,
    });
    return;
  }

  logger.error(
    {
      service: 'scheduling',
      operation: 'request',
      errorCode: 'SCHEDULING_INTERNAL_ERROR',
    },
    'Scheduling request failed'
  );
  res.status(500).json({
    error: SAFE_INTERNAL_ERROR_MESSAGE,
    code: ApiErrorCode.INTERNAL_ERROR,
  });
}
