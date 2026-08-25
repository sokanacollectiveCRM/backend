/**
 * Production verification for INV-10 simulate-payment route removal.
 *
 * Usage:
 *   BACKEND_URL=https://sokana-private-api-....run.app npx tsx scripts/verify-inv10-simulate-payment-prod.ts
 *
 * Optional env (from .env):
 *   TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD — authenticated admin 404 checks
 */
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = (
  process.env.BACKEND_URL ||
  process.env.API_URL ||
  'https://sokana-private-api-46lcr3n2qa-uc.a.run.app'
).replace(/\/$/, '');

const CARD_PROBE = {
  amount: '1.00',
  card: {
    number: '4111111111111111',
    expMonth: '12',
    expYear: '2099',
    cvc: '123',
  },
};

type Check = {
  label: string;
  run: () => Promise<{ status: number; body: string }>;
  expectStatus: number;
};

async function login(email: string, password: string): Promise<string | null> {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    token?: string;
    error?: string;
  };
  if (!res.ok || !body.token) {
    return null;
  }
  return body.token;
}

async function post(
  path: string,
  payload: unknown,
  token?: string
): Promise<{ status: number; body: string }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['X-Session-Token'] = token;
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const body = await res.text();
  return { status: res.status, body };
}

async function main(): Promise<void> {
  const adminEmail = process.env.TEST_ADMIN_EMAIL || process.env.ADMIN_EMAIL;
  const adminPassword =
    process.env.TEST_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
  let adminToken: string | null = null;

  if (adminEmail && adminPassword) {
    adminToken = await login(adminEmail, adminPassword);
    if (!adminToken) {
      console.warn(
        'WARN: admin login failed; authenticated checks will be skipped'
      );
    }
  } else {
    console.warn(
      'WARN: TEST_ADMIN_EMAIL/PASSWORD not set; authenticated checks skipped'
    );
  }

  const checks: Check[] = [
    {
      label: 'unauthenticated POST /api/quickbooks/simulate-payment → 404',
      run: () => post('/api/quickbooks/simulate-payment', CARD_PROBE),
      expectStatus: 404,
    },
    {
      label: 'unauthenticated POST /quickbooks/simulate-payment → 404',
      run: () => post('/quickbooks/simulate-payment', CARD_PROBE),
      expectStatus: 404,
    },
    {
      label: 'unauthenticated POST /api/payment-methods → 401 (route mounted)',
      run: () =>
        post('/api/payment-methods', {
          client_id: '123e4567-e89b-12d3-a456-426614174000',
          intuit_token: 'tok_probe',
          request_id: 'req_probe',
        }),
      expectStatus: 401,
    },
  ];

  if (adminToken) {
    checks.push(
      {
        label: 'admin POST /api/quickbooks/simulate-payment → 404',
        run: () =>
          post('/api/quickbooks/simulate-payment', CARD_PROBE, adminToken!),
        expectStatus: 404,
      },
      {
        label: 'admin POST /quickbooks/simulate-payment → 404',
        run: () =>
          post('/quickbooks/simulate-payment', CARD_PROBE, adminToken!),
        expectStatus: 404,
      },
      {
        label: 'admin POST /api/payment-methods (invalid token) → not 404',
        run: () =>
          post(
            '/api/payment-methods',
            {
              client_id: '123e4567-e89b-12d3-a456-426614174000',
              intuit_token: 'tok_probe',
              request_id: 'req_probe',
            },
            adminToken!
          ),
        expectStatus: 400,
      }
    );
  }

  console.log(`INV-10 production verification — ${BASE_URL}\n`);

  let failed = 0;
  for (const check of checks) {
    const { status, body } = await check.run();
    const pass = check.label.includes('not 404')
      ? status !== 404
      : status === check.expectStatus;
    const icon = pass ? 'PASS' : 'FAIL';
    if (!pass) {
      failed += 1;
    }
    console.log(`${icon}  ${check.label}`);
    console.log(
      `      HTTP ${status}${body ? ` — ${body.slice(0, 120)}` : ''}`
    );
  }

  console.log('');
  if (failed > 0) {
    console.error(`${failed} check(s) failed`);
    process.exit(1);
  }
  console.log('All checks passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
