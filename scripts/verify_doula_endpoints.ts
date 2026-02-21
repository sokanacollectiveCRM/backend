/**
 * Verify Cloud SQL-backed doula endpoints.
 *
 * Usage:
 *   TEST_ADMIN_EMAIL=... TEST_ADMIN_PASSWORD=... npx tsx scripts/verify_doula_endpoints.ts
 */

import 'dotenv/config';
import axios from 'axios';

type ListResponse<T> = {
  data: T[];
  meta: {
    limit: number;
    offset: number;
    count: number;
  };
};

function getBaseUrl(): string {
  return process.env.BACKEND_URL || 'http://localhost:5050';
}

function getAdminCredentials(): { email: string; password: string } {
  const email = process.env.TEST_ADMIN_EMAIL;
  const password = process.env.TEST_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('Missing TEST_ADMIN_EMAIL or TEST_ADMIN_PASSWORD environment variables.');
  }
  return { email, password };
}

async function login(baseUrl: string, email: string, password: string): Promise<string> {
  const res = await axios.post(
    `${baseUrl}/auth/login`,
    { email, password },
    {
      headers: { 'Content-Type': 'application/json' },
      validateStatus: () => true,
    }
  );

  if (res.status !== 200 || !res.data?.token) {
    throw new Error(`Login failed (status ${res.status}).`);
  }

  return String(res.data.token);
}

async function callListEndpoint<T>(baseUrl: string, token: string, path: string): Promise<{ status: number; body: ListResponse<T> | null }> {
  const res = await axios.get(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    validateStatus: () => true,
  });

  const body = res.status === 200 ? (res.data as ListResponse<T>) : null;
  return { status: res.status, body };
}

function printEndpointResult<T>(name: string, status: number, body: ListResponse<T> | null): void {
  console.log(`\n${name}`);
  console.log(`status: ${status}`);
  if (!body) {
    console.log('meta.count: (unavailable)');
    console.log('first item: (unavailable)');
    return;
  }

  console.log(`meta.count: ${body.meta?.count ?? 0}`);
  console.log('first item:');
  console.log(JSON.stringify(body.data?.[0] ?? null, null, 2));
}

async function main(): Promise<void> {
  const baseUrl = getBaseUrl();
  const { email, password } = getAdminCredentials();
  const token = await login(baseUrl, email, password);

  const doulas = await callListEndpoint(baseUrl, token, '/api/doulas?limit=5');
  printEndpointResult('GET /api/doulas?limit=5', doulas.status, doulas.body);

  const assignments = await callListEndpoint(baseUrl, token, '/api/doula-assignments?limit=5');
  printEndpointResult('GET /api/doula-assignments?limit=5', assignments.status, assignments.body);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

