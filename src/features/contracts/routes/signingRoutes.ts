import { NextFunction, Request, Response, Router } from 'express';
import { ZodError } from 'zod';

import { SigningController } from '../controllers/signingController';
import { RateLimitExceededError } from '../services/rateLimitService';

function redactTokenPath(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  // Express has already captured req.params.token. Remove it from path fields
  // that HTTP loggers commonly serialize at response completion.
  const token = req.params.token;
  if (token) {
    req.url = req.url.replace(token, '[redacted]');
    req.originalUrl = req.originalUrl.replace(token, '[redacted]');
  }
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
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });

  router.get('/:token/document', redactTokenPath, controller.document);
  router.get('/:token', redactTokenPath, controller.get);
  router.post('/:token/progress', redactTokenPath, controller.progress);
  router.post('/:token/complete', redactTokenPath, controller.complete);
  router.use(safeError);
  return router;
}
