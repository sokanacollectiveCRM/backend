import {
  getSessionToken,
  getSessionTokenAndSource,
} from '../middleware/authMiddleware';
import {
  getAuthTransportCounters,
  recordAuthTransport,
  resetAuthTransportCountersForTests,
} from '../security/authTransportTelemetry';
import {
  MemoryAuthoritativeRoleLookup,
  resetAuthoritativeRoleLookupForTests,
  resolveAuthoritativeRole,
  setAuthoritativeRoleLookupForTests,
} from '../security/resolveAuthoritativeRole';
import {
  LEGACY_SESSION_COOKIE,
  SESSION_COOKIE,
  clearSessionCookies,
  setSessionCookie,
} from '../security/sessionCookies';

describe('PR 6 authoritative roles', () => {
  afterEach(() => {
    resetAuthoritativeRoleLookupForTests();
  });

  it('never grants staff from metadata alone (fail closed to client)', async () => {
    setAuthoritativeRoleLookupForTests(new MemoryAuthoritativeRoleLookup());
    const role = await resolveAuthoritativeRole({
      authUserId: 'user-1',
      email: 'attacker@example.com',
      appManagedRole: null, // metadata ignored by caller
    });
    expect(role).toBe('client');
  });

  it('grants admin from Cloud SQL admins row', async () => {
    setAuthoritativeRoleLookupForTests(
      new MemoryAuthoritativeRoleLookup({
        admins: [{ id: 'admin-1', email: 'admin@example.com' }],
      })
    );
    await expect(
      resolveAuthoritativeRole({
        authUserId: 'admin-1',
        email: 'admin@example.com',
        appManagedRole: 'client',
      })
    ).resolves.toBe('admin');
  });

  it('grants doula from Cloud SQL doulas row', async () => {
    setAuthoritativeRoleLookupForTests(
      new MemoryAuthoritativeRoleLookup({
        doulas: [{ id: 'doula-1', email: 'doula@example.com' }],
      })
    );
    await expect(
      resolveAuthoritativeRole({
        authUserId: 'doula-1',
        email: 'doula@example.com',
        appManagedRole: null,
      })
    ).resolves.toBe('doula');
  });

  it('trusts app-managed public.users billing role', async () => {
    setAuthoritativeRoleLookupForTests(new MemoryAuthoritativeRoleLookup());
    await expect(
      resolveAuthoritativeRole({
        authUserId: 'bill-1',
        email: 'billing@example.com',
        appManagedRole: 'billing',
      })
    ).resolves.toBe('billing');
  });

  it('keeps client when phi_clients links auth user', async () => {
    setAuthoritativeRoleLookupForTests(
      new MemoryAuthoritativeRoleLookup({
        clients: [{ userId: 'client-1' }],
      })
    );
    await expect(
      resolveAuthoritativeRole({
        authUserId: 'client-1',
        email: 'client@example.com',
        appManagedRole: null,
      })
    ).resolves.toBe('client');
  });
});

describe('PR 6 session token dual-support', () => {
  it('prefers X-Session-Token over Bearer and cookies', () => {
    const req: any = {
      headers: {
        'x-session-token': 'header-token',
        authorization: 'Bearer bearer-token',
      },
      cookies: {
        [SESSION_COOKIE]: 'cookie-token',
        [LEGACY_SESSION_COOKIE]: 'legacy-token',
      },
    };
    expect(getSessionTokenAndSource(req)).toEqual({
      token: 'header-token',
      source: 'header',
    });
  });

  it('falls back to Bearer, then sb-access-token, then legacy session cookie', () => {
    expect(
      getSessionTokenAndSource({
        headers: { authorization: 'Bearer bearer-token' },
        cookies: {},
      } as any)
    ).toEqual({ token: 'bearer-token', source: 'bearer' });

    expect(
      getSessionTokenAndSource({
        headers: {},
        cookies: { [SESSION_COOKIE]: 'cookie-token' },
      } as any)
    ).toEqual({ token: 'cookie-token', source: 'cookie' });

    expect(
      getSessionTokenAndSource({
        headers: {},
        cookies: { [LEGACY_SESSION_COOKIE]: 'legacy-token' },
      } as any)
    ).toEqual({ token: 'legacy-token', source: 'legacy_session_cookie' });

    expect(
      getSessionToken({ headers: {}, cookies: {} } as any)
    ).toBeUndefined();
  });
});

describe('PR 6 cookie helpers and transport telemetry', () => {
  beforeEach(() => {
    resetAuthTransportCountersForTests();
  });

  it('sets canonical cookie and clears legacy session cookie', () => {
    const cookies: Record<string, unknown> = {};
    const cleared: string[] = [];
    const res: any = {
      cookie: (name: string, value: string) => {
        cookies[name] = value;
      },
      clearCookie: (name: string) => {
        cleared.push(name);
        delete cookies[name];
      },
    };

    setSessionCookie(res, 'tok-123');
    expect(cookies[SESSION_COOKIE]).toBe('tok-123');
    expect(cleared).toContain(LEGACY_SESSION_COOKIE);

    clearSessionCookies(res);
    expect(cleared).toEqual(
      expect.arrayContaining([SESSION_COOKIE, LEGACY_SESSION_COOKIE])
    );
  });

  it('records legacy transport counters without storing tokens', () => {
    recordAuthTransport('legacy.login_json_token_returned');
    recordAuthTransport('legacy.body_access_token');
    recordAuthTransport('legacy.query_access_token');
    const snapshot = getAuthTransportCounters();
    expect(snapshot['legacy.login_json_token_returned']).toBe(1);
    expect(snapshot['legacy.body_access_token']).toBe(1);
    expect(snapshot['legacy.query_access_token']).toBe(1);
    expect(JSON.stringify(snapshot)).not.toMatch(/eyJ|tok-|secret/i);
  });
});
