import { NextFunction, Request, Response } from 'express';
import { ZodError, ZodTypeAny, z } from 'zod';

import { validationErrorBody } from '../common/http/apiEnvelope';

export type RequestValidationSchemas = {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
};

function isPartsBag(value: unknown): value is RequestValidationSchemas {
  if (!value || typeof value !== 'object') return false;
  // Zod schemas expose parse/safeParse; our parts bag does not.
  if (typeof (value as { safeParse?: unknown }).safeParse === 'function') {
    return false;
  }
  return 'body' in value || 'params' in value || 'query' in value;
}

/**
 * Validate body and/or params/query with Zod.
 * - `validateRequest(zodSchema)` → body only (back-compat)
 * - `validateRequest({ body, params, query })` → selected parts
 * On failure: 400 `{ success: false, error, code: 'VALIDATION_ERROR', details? }`
 */
export function validateRequest(schemaOrParts: ZodTypeAny | RequestValidationSchemas) {
  const parts: RequestValidationSchemas = isPartsBag(schemaOrParts)
    ? schemaOrParts
    : { body: schemaOrParts as ZodTypeAny };

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (parts.body) {
        req.body = await parts.body.parseAsync(req.body);
      }
      if (parts.params) {
        const parsed = await parts.params.parseAsync(req.params);
        Object.assign(req.params, parsed);
      }
      if (parts.query) {
        const parsed = await parts.query.parseAsync(req.query);
        Object.assign(req.query, parsed as Record<string, unknown>);
      }
      next();
    } catch (error) {
      const details =
        error instanceof ZodError
          ? error.issues.map((issue) => ({
              path: issue.path.join('.'),
              message: issue.message,
            }))
          : undefined;
      const message =
        error instanceof ZodError && error.issues[0]?.message
          ? error.issues[0].message
          : 'Invalid request data';
      res.status(400).json(validationErrorBody(message, details));
    }
  };
}

/** Convenience: body-only schema. */
export function validateBody(schema: ZodTypeAny) {
  return validateRequest({ body: schema });
}

export { z };
