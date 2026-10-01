/**
 * Canonical HttpOnly session cookie for staff CRM sessions.
 * Legacy names (`sb-access-token`, `session`) are cleared on set/logout and still
 * readable temporarily for dual-support.
 */
import { CookieOptions, Response } from 'express';

import { IS_PRODUCTION } from '../config/env';

export const SESSION_COOKIE = 'sokana_session_token';
/** Previous canonical cookie name (PR 6) — read + clear only. */
export const LEGACY_SB_SESSION_COOKIE = 'sb-access-token';
/** Legacy cookie name previously set by OAuth / handleToken. */
export const LEGACY_SESSION_COOKIE = 'session';

const SESSION_MAX_AGE_MS = 3600 * 1000;

const LEGACY_COOKIE_NAMES = [
  LEGACY_SB_SESSION_COOKIE,
  LEGACY_SESSION_COOKIE,
] as const;

export function sessionCookieOptions(
  overrides: CookieOptions = {}
): CookieOptions {
  return {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_MS,
    path: '/',
    ...overrides,
  };
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
  const clearOpts = sessionCookieOptions({ maxAge: undefined });
  for (const name of LEGACY_COOKIE_NAMES) {
    res.clearCookie(name, clearOpts);
  }
}

export function clearSessionCookies(res: Response): void {
  const clearOpts = sessionCookieOptions({ maxAge: undefined });
  res.clearCookie(SESSION_COOKIE, clearOpts);
  for (const name of LEGACY_COOKIE_NAMES) {
    res.clearCookie(name, clearOpts);
  }
}
