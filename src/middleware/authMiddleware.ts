import { NextFunction, Response } from 'express';
import { authService } from '../index';
import supabase from '../supabase';
import type { AuthRequest } from '../types';
import { logger } from '../common/utils/logger';
import { SAFE_INTERNAL_ERROR_MESSAGE } from '../common/utils/safeLogging';
import { recordAuthTransport } from '../security/authTransportTelemetry';
import { ApiErrorCode } from '../security/errorCodes';
import {
  LEGACY_SESSION_COOKIE,
  SESSION_COOKIE,
} from '../security/sessionCookies';

/** Cookie and header names for session token (canonical). */
export { SESSION_COOKIE } from '../security/sessionCookies';
export const SESSION_HEADER = 'x-session-token';

export type SessionSource = 'cookie' | 'header' | 'bearer' | 'legacy_session_cookie';

/**
 * Resolve session token from request.
 * Priority (target + dual-support):
 *   X-Session-Token → Authorization Bearer → sb-access-token → legacy `session` cookie.
 * Body/query tokens are not accepted for API auth (measured separately where seen).
 */
export function getSessionToken(req: AuthRequest): string | undefined {
  return getSessionTokenAndSource(req).token;
}

/** For introspection / telemetry: which source provided the token. */
export function getSessionTokenAndSource(req: AuthRequest): {
  token?: string;
  source?: SessionSource;
} {
  const headerToken = req.headers[SESSION_HEADER] as string | undefined;
  if (headerToken && typeof headerToken === 'string' && headerToken.trim()) {
    return { token: headerToken.trim(), source: 'header' };
  }
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) return { token, source: 'bearer' };
  }
  if (req.cookies?.[SESSION_COOKIE]) {
    return { token: req.cookies[SESSION_COOKIE], source: 'cookie' };
  }
  if (req.cookies?.[LEGACY_SESSION_COOKIE]) {
    return {
      token: req.cookies[LEGACY_SESSION_COOKIE],
      source: 'legacy_session_cookie',
    };
  }
  return {};
}

function recordTokenSource(source: SessionSource | undefined, req: AuthRequest): void {
  if (!source) return;
  if (source === 'cookie') recordAuthTransport('token_source.cookie', { path: req.path, method: req.method });
  else if (source === 'header') recordAuthTransport('token_source.header', { path: req.path, method: req.method });
  else if (source === 'bearer') recordAuthTransport('token_source.bearer', { path: req.path, method: req.method });
  else if (source === 'legacy_session_cookie') {
    recordAuthTransport('token_source.legacy_session_cookie', { path: req.path, method: req.method });
    recordAuthTransport('legacy.session_cookie_seen', { path: req.path, method: req.method });
  }
}

const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Measure query-token attempts without accepting them for session auth.
    const queryToken =
      (typeof req.query?.access_token === 'string' && req.query.access_token) ||
      (typeof req.query?.token === 'string' && req.query.token);
    if (queryToken) {
      recordAuthTransport('legacy.query_access_token', { path: req.path, method: req.method });
    }

    const { token, source } = getSessionTokenAndSource(req);

    if (!token) {
      logger.warn({
        context: 'authMiddleware',
        path: req.path,
        method: req.method
      }, 'No token provided');
      res.status(401).json({
        error: 'No session token provided',
        code: ApiErrorCode.UNAUTHENTICATED,
        hint: 'Provide Cookie or X-Session-Token header'
      });
      return;
    }

    recordTokenSource(source, req);

    const {
      data: { user },
      error
    } = await supabase.auth.getUser(token)

    if (error || !user) {
      logger.warn({
        context: 'authMiddleware',
        path: req.path,
        error: error?.message,
        hasUser: !!user
      }, 'Invalid or expired token');
      res.status(401).json({
        error: 'Invalid or expired session token',
        code: ApiErrorCode.UNAUTHENTICATED,
      });
      return
    }

    const user_entity = await authService.getUserFromToken(token)
    req.user = user_entity;
    next();
  } catch (err: any) {
    logger.error({ err, context: 'authMiddleware', path: req.path }, 'Middleware error');
    res.status(500).json({
      error: SAFE_INTERNAL_ERROR_MESSAGE,
      code: ApiErrorCode.INTERNAL_ERROR,
    });
  }
};

export default authMiddleware
