import type { RequestHandler } from 'express';

import {
  readTenantRequestState,
  runWithTenantState,
} from '../features/tenancy';

/** Multipart parsers can call next from stream resources created before auth. */
export function preserveTenantContext(
  middleware: RequestHandler
): RequestHandler {
  return (req, res, next) => {
    const context = readTenantRequestState();
    middleware(req, res, (error?: unknown) => {
      runWithTenantState(context, () => next(error));
    });
  };
}
