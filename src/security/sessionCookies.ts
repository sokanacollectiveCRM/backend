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

export function sessionCookieOptions(
  overrides: CookieOptions = {}
): CookieOptions {
  return {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: IS_PRODUCTION ? 'none' : 'lax',
    maxAge: SESSION_MAX_AGE_MS,
    path: '/',
    // CHIPS: Chrome rejects unpartitioned third-party cookies. Safari still
    // blocks third-party cookies entirely; clients must also send the JSON
    // login token as Authorization / X-Session-Token.
    ...(IS_PRODUCTION ? { partitioned: true } : {}),
    ...overrides,
  };
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
  // Drop legacy cookie so browsers converge on the canonical name.
  res.clearCookie(
    LEGACY_SESSION_COOKIE,
    sessionCookieOptions({ maxAge: undefined })
  );
}

export function clearSessionCookies(res: Response): void {
  const clearOpts = sessionCookieOptions({ maxAge: undefined });
  res.clearCookie(SESSION_COOKIE, clearOpts);
  res.clearCookie(LEGACY_SESSION_COOKIE, clearOpts);
  // Also drop pre-CHIPS cookies (same name, no Partitioned) so logout still
  // clears sessions issued before the partitioned flag was added.
  if (IS_PRODUCTION) {
    const unpartitionedClear = sessionCookieOptions({
      maxAge: undefined,
      partitioned: false,
    });
    res.clearCookie(SESSION_COOKIE, unpartitionedClear);
    res.clearCookie(LEGACY_SESSION_COOKIE, unpartitionedClear);
  }
}
