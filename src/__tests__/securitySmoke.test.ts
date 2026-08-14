/**
 * Bounded security smoke suite.
 *
 * Purpose (PR 2): establish a mandatory CI entrypoint for later auth-matrix /
 * endpoint-authorization coverage (PR 4+) without changing production auth yet.
 *
 * This file intentionally stays small and side-effect free:
 * - no live Cloud SQL / Supabase / vendor calls
 * - no route hardening or behavior changes
 * - no long-lived HTTP servers (avoids Jest open handles)
 * - documents the freeze inventory that future matrix tests must expand against
 */
import {
  PILOT_CRITICAL_PROTECTED_PREFIXES,
  PILOT_CRITICAL_PUBLIC_PATHS,
  SECURITY_SMOKE_BASELINE,
  buildHealthPayload,
} from '../security/securitySmokeBaseline';

describe('security smoke (bounded baseline)', () => {
  it('records the freeze baseline counts for later auth-matrix expansion', () => {
    expect(SECURITY_SMOKE_BASELINE.minPassingTests).toBeGreaterThanOrEqual(300);
    expect(SECURITY_SMOKE_BASELINE.nodeEngine).toBe('20.x');
    expect(PILOT_CRITICAL_PUBLIC_PATHS.length).toBeGreaterThan(0);
    expect(PILOT_CRITICAL_PROTECTED_PREFIXES.length).toBeGreaterThan(0);
  });

  it('keeps the frozen lightweight /health contract shape', () => {
    const payload = buildHealthPayload(new Date('2026-08-11T12:00:00.000Z'));
    expect(payload).toEqual({
      status: 'ok',
      service: 'sokana-private-api',
      timestamp: '2026-08-11T12:00:00.000Z',
    });
  });

  it('lists public vs protected pilot surfaces for upcoming matrix tests', () => {
    expect(PILOT_CRITICAL_PUBLIC_PATHS).toEqual(
      expect.arrayContaining([
        'GET /health',
        'POST /login',
        'POST /auth/login',
        'POST /requestService/requestSubmission',
        'POST /api/signnow/callback',
        'POST /quickbooks/webhooks/invoice-paid',
      ])
    );
    expect(PILOT_CRITICAL_PROTECTED_PREFIXES).toEqual(
      expect.arrayContaining([
        '/clients',
        '/api/doulas',
        '/api/admin',
        '/contracts',
        '/api/billing',
        '/api/payments',
        '/api/contract-signing',
        '/api/signnow',
      ])
    );
  });
});
