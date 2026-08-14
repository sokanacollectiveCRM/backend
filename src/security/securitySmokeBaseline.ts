/**
 * Freeze inventory used by `npm run test:security-smoke` and auth-matrix tests.
 */

export const SECURITY_SMOKE_BASELINE = {
  recordedAt: '2026-08-14',
  suites: 46,
  minPassingTests: 374,
  nodeEngine: '20.x',
  docs: [
    'docs/ROUTE_RESPONSE_CONTRACT_INVENTORY.md',
    'docs/PILOT_JOURNEYS_AND_ROLLBACK.md',
    'docs/ENDPOINT_AUTHORIZATION_MATRIX.md',
  ],
} as const;

/** Public (or intentionally unauthenticated) pilot-critical surfaces. */
export const PILOT_CRITICAL_PUBLIC_PATHS = [
  'GET /',
  'GET /health',
  'POST /login',
  'POST /auth/login',
  'POST /auth/logout',
  'POST /requestService/requestSubmission',
  'POST /api/signnow/callback',
  'POST /quickbooks/webhooks/invoice-paid',
  'GET /quickbooks/auth',
  'GET /quickbooks/callback',
] as const;

/**
 * Prefixes that pilot CRM journeys treat as authenticated.
 * Individual routes inside these prefixes still vary by role; see auth matrix.
 */
export const PILOT_CRITICAL_PROTECTED_PREFIXES = [
  '/clients',
  '/client',
  '/api/clients',
  '/api/client',
  '/api/doulas',
  '/api/admin',
  '/contracts',
  '/api/contracts',
  '/api/contract',
  '/api/contract-signing',
  '/api/pdf-contract',
  '/api/signnow',
  '/api/billing',
  '/api/payments',
  '/api/invoices',
  '/api/financial',
  '/api/dashboard',
  '/quickbooks',
  '/api/quickbooks',
  '/api/payment-methods',
  '/email',
] as const;

/** Mirrors the lightweight Cloud Run health JSON (shape freeze only). */
export function buildHealthPayload(now: Date = new Date()): {
  status: 'ok';
  service: 'sokana-private-api';
  timestamp: string;
} {
  return {
    status: 'ok',
    service: 'sokana-private-api',
    timestamp: now.toISOString(),
  };
}
