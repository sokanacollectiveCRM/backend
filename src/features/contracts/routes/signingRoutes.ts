import { NextFunction, Request, Response, Router } from 'express';
import { ZodError } from 'zod';

import { SigningController } from '../controllers/signingController';
import { InvalidInvitationError } from '../services/invitationService';
import { RateLimitExceededError } from '../services/rateLimitService';
import { InvalidSigningAccessSessionError } from '../services/signingAccessSessionService';
import { SigningInputError } from '../services/signingSessionService';

function signingSecurityHeaders(
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
}

function safeError(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const candidate = error as { statusCode?: number; message?: string };
  const status =
    error instanceof ZodError
      ? 400
      : error instanceof InvalidSigningAccessSessionError
        ? 401
        : error instanceof InvalidInvitationError
          ? 404
          : error instanceof SigningInputError
            ? 400
            : typeof candidate?.statusCode === 'number'
              ? candidate.statusCode
              : 500;
  if (error instanceof RateLimitExceededError) {
    res.setHeader('Retry-After', String(error.retryAfterSeconds));
  }
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json({
    error: status >= 500 ? 'Internal server error' : candidate.message,
  });
}

export function createSigningRoutes(controller: SigningController): Router {
  const router = Router();
  router.use(signingSecurityHeaders);

  router.post('/session/exchange', controller.exchange);
  router.get('/session', controller.get);
  router.get('/session/document', controller.document);
  router.post('/session/progress', controller.progress);
  router.post('/session/complete', controller.complete);

  router.get('/:token/document', controller.legacyUnavailable);
  router.get('/:token', controller.legacyUnavailable);
  router.post('/:token/progress', controller.legacyUnavailable);
  router.post('/:token/complete', controller.legacyUnavailable);

  router.use(safeError);
  return router;
}
