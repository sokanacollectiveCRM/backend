/**
 * Log in as a user, then fetch Cloud SQL data (GET /clients) and print to terminal.
 * Uses BACKEND_URL, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD from env (or defaults).
 *
 * Usage: npx tsx scripts/fetch-cloudsql-data.ts
 *        TEST_ADMIN_EMAIL=you@example.com TEST_ADMIN_PASSWORD=secret npx tsx scripts/fetch-cloudsql-data.ts
 */

import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = (process.env.BACKEND_URL || 'http://localhost:5050').replace(/\/$/, '');
const EMAIL = process.env.TEST_ADMIN_EMAIL || 'jerrybony5@gmail.com';
const PASSWORD = process.env.TEST_ADMIN_PASSWORD || '';

async function main() {
  if (!PASSWORD) {
    console.error('Set TEST_ADMIN_PASSWORD in .env or pass it when running.');
    process.exit(1);
  }

  console.log('1) Logging in...');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });

  if (!loginRes.ok) {
    const err = await loginRes.text();
    console.error('Login failed:', loginRes.status, err);
    process.exit(1);
  }

  const loginBody = await loginRes.json();
  const token = loginBody.token;

  // Prefer Bearer token if backend returns it; otherwise use cookie from response
  const setCookie = loginRes.headers.get('set-cookie') || '';
  const cookieMatch = setCookie.match(/sb-access-token=([^;]+)/);
  const cookie = cookieMatch ? `sb-access-token=${cookieMatch[1]}` : null;

  const authHeaders: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : cookie
      ? { Cookie: cookie }
      : {};

  if (!token && !cookie) {
    console.error('Login response had no token and no sb-access-token cookie.');
    process.exit(1);
  }

  console.log('   OK – logged in as', loginBody.user?.email || EMAIL, `(role: ${loginBody.user?.role || '?'})\n`);

  console.log('2) Fetching clients (Cloud SQL when CLOUD_SQL_HOST is set)...');
  const clientsRes = await fetch(`${BASE_URL}/clients?limit=50`, {
    headers: authHeaders,
  });

  if (!clientsRes.ok) {
    const err = await clientsRes.text();
    console.error('GET /clients failed:', clientsRes.status, err);
    if (clientsRes.status === 503 && err.includes('CLOUD_SQL')) {
      console.error('\nTo get data from Google Cloud SQL: set CLOUD_SQL_HOST, CLOUD_SQL_DATABASE, CLOUD_SQL_USER, CLOUD_SQL_PASSWORD in .env and restart the backend.');
    }
    process.exit(1);
  }

  const data = await clientsRes.json();
  console.log('   OK\n');
  console.log('--- Cloud SQL data (GET /clients) ---');
  console.log(JSON.stringify(data, null, 2));
  console.log('---');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
