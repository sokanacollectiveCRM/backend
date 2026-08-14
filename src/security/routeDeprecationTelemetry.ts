/**
 * Route-alias deprecation telemetry + HTTP headers (PR 7).
 * Does not remove aliases. Never logs request bodies or tokens.
 */

import { NextFunction, Request, RequestHandler, Response } from 'express';

import { logger } from '../common/utils/logger';

const counters = new Map<string, number>();

/** Default Sunset for pilot aliases (RFC 8594 date). Adjust when retirement is scheduled. */
export const DEFAULT_ALIAS_SUNSET = 'Sat, 14 Feb 2027 00:00:00 GMT';

export function recordRouteDeprecation(
  aliasKey: string,
  context?: Record<string, unknown>,
): void {
  const next = (counters.get(aliasKey) ?? 0) + 1;
  counters.set(aliasKey, next);
  logger.info(
    {
      service: 'route-deprecation',
      event: 'alias_hit',
      aliasKey,
      count: next,
      ...(context || {}),
    },
    'Deprecated route alias used',
  );
}

export function getRouteDeprecationCounters(): Record<string, number> {
  return Object.fromEntries(counters.entries());
}

export function resetRouteDeprecationCountersForTests(): void {
  counters.clear();
}

export function setDeprecationHeaders(
  res: Response,
  options: {
    successorPath: string;
    sunset?: string;
  },
): void {
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', options.sunset ?? DEFAULT_ALIAS_SUNSET);
  res.setHeader('Link', `<${options.successorPath}>; rel="successor-version"`);
}

/**
 * Middleware: mark this mount as a deprecated alias of `successorPath`.
 * Applies to every request under the mount; JSON bodies are unchanged.
 */
export function deprecateAlias(options: {
  aliasKey: string;
  successorPath: string;
  sunset?: string;
}): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    setDeprecationHeaders(res, {
      successorPath: options.successorPath,
      sunset: options.sunset,
    });
    recordRouteDeprecation(options.aliasKey, {
      path: req.path,
      method: req.method,
      originalUrl: req.originalUrl,
    });
    next();
  };
}
