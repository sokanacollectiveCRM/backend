import { NextFunction, Response } from 'express';
import { authService } from '../index';
import supabase from '../supabase';
import type { AuthRequest } from '../types';
import { logger } from '../common/utils/logger';
import { IS_PRODUCTION } from '../config/env';

/** Cookie and header names for session token. */
export const SESSION_COOKIE = 'sb-access-token';
export const SESSION_HEADER = 'x-session-token';

export type SessionSource = 'cookie' | 'header' | 'bearer';

/**
 * Resolve session token from request.
 * Priority: X-Session-Token > Authorization: Bearer > Cookie (dev only).
 * X-Session-Token is preferred when both are present (Cloud Run IAM sends Bearer; backend uses X-Session-Token for Supabase JWT).
 */
export function getSessionToken(req: AuthRequest): string | undefined {
  const headerToken = req.headers[SESSION_HEADER] as string | undefined;
  if (headerToken && typeof headerToken === 'string' && headerToken.trim()) {
    return headerToken.trim();
  }
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }
  if (!IS_PRODUCTION && req.cookies?.[SESSION_COOKIE]) {
    return req.cookies[SESSION_COOKIE];
  }
  return undefined;
}

/** For introspection: which source provided the token. */
export function getSessionTokenAndSource(req: AuthRequest): { token?: string; source?: SessionSource } {
  const headerToken = req.headers[SESSION_HEADER] as string | undefined;
  if (headerToken && typeof headerToken === 'string' && headerToken.trim()) {
    return { token: headerToken.trim(), source: 'header' };
  }
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) return { token, source: 'bearer' };
  }
  if (!IS_PRODUCTION && req.cookies?.[SESSION_COOKIE]) {
    return { token: req.cookies[SESSION_COOKIE], source: 'cookie' };
  }
  return {};
}

const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = getSessionToken(req);

    if (!token) {
      logger.warn({
        context: 'authMiddleware',
        path: req.path,
        method: req.method
      }, 'No token provided');
      res.status(401).json({
        error: 'No session token provided',
        hint: 'Provide Cookie or X-Session-Token header'
      });
      return;
    }

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
      res.status(401).json({ error: 'Invalid or expired session token' })
      return
    }

    // Your app's user object
    const user_entity = await authService.getUserFromToken(token)
    req.user = user_entity;
    next();
  } catch (err: any) {
    logger.error({ err, context: 'authMiddleware', path: req.path }, 'Middleware error');
    res.status(500).json({ error: 'Internal server error' });
  }
};



export default authMiddleware
