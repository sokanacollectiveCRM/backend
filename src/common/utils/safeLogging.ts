import { NextFunction, Request, RequestHandler, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { Logger } from 'pino';

export type SafeProviderError = {
  service: string;
  operation: string;
  errorCode: string;
  status?: number;
  correlationId?: string;
  retryable: boolean;
};

const safeStatus = (error: unknown): number | undefined => {
  const value = (error as { response?: { status?: unknown }; status?: unknown }) || {};
  const candidate = value.response?.status ?? value.status;
  return typeof candidate === 'number' && candidate >= 400 && candidate <= 599
    ? candidate
    : undefined;
};

export const toSafeProviderError = (
  service: string,
  operation: string,
  error: unknown,
  correlationId?: string,
): SafeProviderError => {
  const status = safeStatus(error);
  return {
    service,
    operation,
    errorCode: status ? `PROVIDER_HTTP_${status}` : 'PROVIDER_FAILURE',
    ...(status ? { status } : {}),
    ...(correlationId ? { correlationId } : {}),
    retryable: status === 408 || status === 429 || (status !== undefined && status >= 500),
  };
};

const safeRequestId = (value: unknown): string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value) ? value : randomUUID();

const generalizedRoute = (req: Request): string => {
  const routePath = req.route?.path;
  if (typeof routePath === 'string') return `${req.baseUrl || ''}${routePath}` || '/';
  return 'unmatched';
};

/** Request logging is intentionally implemented as an allowlist, not serializers/redaction. */
export const createSafeRequestLogger = (requestLogger: Logger): RequestHandler =>
  (req: Request, res: Response, next: NextFunction): void => {
    const startedAt = process.hrtime.bigint();
    const correlationId = safeRequestId(req.get('x-request-id'));
    res.setHeader('x-request-id', correlationId);

    res.once('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      requestLogger.info({
        service: 'backend-http',
        correlationId,
        method: req.method,
        route: generalizedRoute(req),
        status: res.statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
      }, 'HTTP request completed');
    });
    next();
  };

/**
 * Legacy console calls are not structured enough to prove their arguments are safe.
 * Production suppresses them; approved operational logging goes through the logger.
 */
export const installProductionConsoleGuard = (): void => {
  if (process.env.NODE_ENV !== 'production') return;
  const noop = (): void => undefined;
  console.log = noop;
  console.info = noop;
  console.warn = noop;
  console.error = noop;
  console.debug = noop;
  console.dir = noop as typeof console.dir;
};

// This module is imported before route/service modules in the server bootstrap, so
// production cannot leak from module-scope constructors during application startup.
installProductionConsoleGuard();
