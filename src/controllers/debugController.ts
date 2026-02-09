/**
 * DEV-only debug endpoints for Cloud Run / curl testing.
 * Gated by ENABLE_DEBUG_ENDPOINTS=true AND NODE_ENV !== 'production'.
 * Never mounted in production.
 */

import { Request, Response } from 'express';
import { authService } from '../index';
import {
  getSessionTokenAndSource,
  SESSION_COOKIE,
  SESSION_HEADER,
} from '../middleware/authMiddleware';
import type { AuthRequest } from '../types';
import { logger } from '../common/utils/logger';

function isDebugEnabled(): boolean {
  return (
    process.env.ENABLE_DEBUG_ENDPOINTS === 'true' &&
    process.env.NODE_ENV !== 'production'
  );
}

/**
 * POST /debug/session-token
 * Accepts { email, password }, runs login, verifies admin, returns Supabase access token.
 * Use with: curl -X POST -H "Content-Type: application/json" -d '{"email":"...","password":"..."}' ...
 */
export async function postSessionToken(req: Request, res: Response): Promise<void> {
  if (!isDebugEnabled()) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  try {
    const { email, password } = req.body ?? {};

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      res.status(400).json({
        success: false,
        error: 'email and password required in JSON body',
      });
      return;
    }

    const result = await authService.login(email.trim(), password);

    if (!result?.user?.role || result.user.role !== 'admin') {
      res.status(403).json({
        success: false,
        error: 'Admin role required for debug session token',
      });
      return;
    }

    const token = result.token;
    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

    // NEVER log the token
    logger.info({
      context: 'debug.session-token',
      userId: result.user.id,
      role: result.user.role,
    }, 'Session token minted');

    res.json({
      success: true,
      session_token: token,
      expires_at: expiresAt,
      usage: {
        header: SESSION_HEADER,
        example: `curl -H 'Authorization: Bearer \$(gcloud auth print-identity-token)' -H '${SESSION_HEADER}: <token>' https://.../clients`,
      },
    });
  } catch (err) {
    logger.warn({
      context: 'debug.session-token',
      error: err instanceof Error ? err.message : String(err),
    }, 'Session token mint failed');
    res.status(401).json({
      success: false,
      error: 'Login failed — invalid credentials or user not admin',
    });
  }
}

/**
 * GET /debug/whoami
 * Requires valid session (cookie or X-Session-Token). Returns auth introspection.
 */
export async function getWhoami(req: AuthRequest, res: Response): Promise<void> {
  if (!isDebugEnabled()) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const { token, source } = getSessionTokenAndSource(req);
  const cookieNames = req.cookies ? Object.keys(req.cookies) : [];

  res.json({
    success: true,
    auth: {
      used: source ?? null,
      cookie_names: cookieNames,
      has_session_cookie: !!req.cookies?.[SESSION_COOKIE],
      has_x_session_token: !!(req.headers[SESSION_HEADER] as string)?.trim(),
    },
    requester: req.user
      ? {
          userId: req.user.id,
          role: (req.user as any).role ?? undefined,
          clientId: undefined,
        }
      : null,
  });
}
