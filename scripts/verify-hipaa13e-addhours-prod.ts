/**
 * Production verification for HIPAA-13E service-hours IDOR.
 *
 * Usage:
 *   BACKEND_URL=https://sokana-private-api-....run.app npx tsx scripts/verify-hipaa13e-addhours-prod.ts
 *
 * Optional env (from .env — never logged):
 *   TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD
 *   TEST_DOULA_EMAIL / TEST_DOULA_PASSWORD
 *   TEST_CLIENT_EMAIL / TEST_CLIENT_PASSWORD
 *   TEST_BILLING_EMAIL / TEST_BILLING_PASSWORD
 *
 * Negative probes use synthetic UUIDs only. No PHI is printed.
 */

import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = (
  process.env.BACKEND_URL ||
  process.env.API_URL ||
  'https://sokana-private-api-634744984887.us-central1.run.app'
).replace(/\/$/, '');

const SYNTHETIC_DOULA_ID = '00000000-0000-4000-8000-000000000001';
const SYNTHETIC_CLIENT_ID = '00000000-0000-4000-8000-000000000002';

const EXPECTED_COMMIT_PREFIX = '66332ab';

type RoleCase = {
  label: string;
  email?: string;
  password?: string;
  expectStatus: number;
  bodyOverrides?: Record<string, unknown>;
  pathId?: string;
};

async function login(
  email: string,
  password: string
): Promise<{ token: string; role?: string; id?: string } | null> {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    token?: string;
    user?: { role?: string; id?: string };
  };
  if (!res.ok || !body.token) return null;
  return {
    token: body.token,
    role: body.user?.role,
    id: body.user?.id,
  };
}

async function addHours(
  pathId: string,
  token: string | undefined,
  body: Record<string, unknown>
): Promise<{ status: number; code?: string }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}/users/${pathId}/addhours`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as { code?: string };
  return { status: res.status, code: json.code };
}

function baseBody(doulaId: string, clientId: string): Record<string, unknown> {
  return {
    doula_id: doulaId,
    client_id: clientId,
    start_time: '2026-08-23T10:00:00.000Z',
    end_time: '2026-08-23T11:00:00.000Z',
    type: 'prenatal',
    note: '',
  };
}

async function main(): Promise<void> {
  console.log('HIPAA-13E production verification');
  console.log(`Backend: ${BASE_URL}`);
  console.log(`Expected merge commit prefix: ${EXPECTED_COMMIT_PREFIX}`);
  console.log('');

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  // Unauthenticated
  {
    const result = await addHours(
      SYNTHETIC_DOULA_ID,
      undefined,
      baseBody(SYNTHETIC_DOULA_ID, SYNTHETIC_CLIENT_ID)
    );
    const ok = result.status === 401;
    if (ok) passed += 1;
    else failed += 1;
    console.log(
      `${ok ? 'PASS' : 'FAIL'} unauthenticated: HTTP ${result.status}${
        result.code ? ` (${result.code})` : ''
      } — expected 401`
    );
  }

  const roleCases: RoleCase[] = [
    {
      label: 'client',
      email: process.env.TEST_CLIENT_EMAIL,
      password: process.env.TEST_CLIENT_PASSWORD,
      expectStatus: 403,
    },
    {
      label: 'billing',
      email: process.env.TEST_BILLING_EMAIL,
      password: process.env.TEST_BILLING_PASSWORD,
      expectStatus: 403,
    },
    {
      label: 'doula-unassigned-client',
      email: process.env.TEST_DOULA_EMAIL,
      password: process.env.TEST_DOULA_PASSWORD,
      expectStatus: 403,
      // Synthetic client id → not assigned → 403
    },
  ];

  for (const testCase of roleCases) {
    if (!testCase.email || !testCase.password) {
      console.log(
        `SKIP ${testCase.label}: set TEST_${testCase.label.split('-')[0].toUpperCase()}_EMAIL/PASSWORD`
      );
      skipped += 1;
      continue;
    }

    const session = await login(testCase.email, testCase.password);
    if (!session) {
      console.log(`SKIP ${testCase.label}: login failed`);
      skipped += 1;
      continue;
    }

    const pathId = session.id || SYNTHETIC_DOULA_ID;
    const body = baseBody(pathId, SYNTHETIC_CLIENT_ID);
    const result = await addHours(pathId, session.token, body);
    const ok = result.status === testCase.expectStatus;
    if (ok) passed += 1;
    else failed += 1;
    console.log(
      `${ok ? 'PASS' : 'FAIL'} ${testCase.label}: HTTP ${result.status}${
        result.code ? ` (${result.code})` : ''
      } [role=${session.role || 'unknown'}] — expected ${testCase.expectStatus}`
    );
  }

  // Altered path ID as doula (IDOR)
  if (process.env.TEST_DOULA_EMAIL && process.env.TEST_DOULA_PASSWORD) {
    const session = await login(
      process.env.TEST_DOULA_EMAIL,
      process.env.TEST_DOULA_PASSWORD
    );
    if (session?.id) {
      const result = await addHours(
        SYNTHETIC_DOULA_ID,
        session.token,
        baseBody(session.id, SYNTHETIC_CLIENT_ID)
      );
      const ok = result.status === 403;
      if (ok) passed += 1;
      else failed += 1;
      console.log(
        `${ok ? 'PASS' : 'FAIL'} doula-altered-path-id: HTTP ${result.status}${
          result.code ? ` (${result.code})` : ''
        } — expected 403`
      );
    } else {
      console.log('SKIP doula-altered-path-id: login failed');
      skipped += 1;
    }
  } else {
    console.log('SKIP doula-altered-path-id: TEST_DOULA_* not set');
    skipped += 1;
  }

  console.log('');
  console.log(`Results: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
