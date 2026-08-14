/**
 * Canonical session cookie helpers (PR 6).
 * Target cookie: sb-access-token. Legacy cookie name `session` is cleared on set/logout
 * and still readable temporarily for dual-support.
 */

import { CookieOptions, Response } from 'express';

import { IS_PRODUCTION } from '../config/env';

export const SESSION_COOKIE = 'sb-access-token';
/** Legacy cookie name previously set by OAuth / handleToken — do not set going forward. */
export const LEGACY_SESSION_COOKIE = 'session';

const SESSION_MAX_AGE_MS = 3600 * 1000;

export function sessionCookieOptions(overrides: CookieOptions = {}): CookieOptions {
  return {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: IS_PRODUCTION ? 'none' : 'lax',
    maxAge: SESSION_MAX_AGE_MS,
    path: '/',
    ...overrides,
  };
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
  // Drop legacy cookie so browsers converge on the canonical name.
  res.clearCookie(LEGACY_SESSION_COOKIE, sessionCookieOptions({ maxAge: undefined }));
}

export function clearSessionCookies(res: Response): void {
  const clearOpts = sessionCookieOptions({ maxAge: undefined });
  res.clearCookie(SESSION_COOKIE, clearOpts);
  res.clearCookie(LEGACY_SESSION_COOKIE, clearOpts);
}
