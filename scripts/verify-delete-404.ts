import dotenv from 'dotenv';
import { randomUUID } from 'crypto';

dotenv.config();

const BASE_URL = (process.env.API_URL || process.env.BACKEND_URL || 'http://localhost:5050').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || '';
const PROVIDED_TOKEN = process.env.DELETE_404_TOKEN || '';

async function getToken(): Promise<string> {
  if (PROVIDED_TOKEN) {
    return PROVIDED_TOKEN;
  }

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error('Missing auth. Set DELETE_404_TOKEN, or TEST_ADMIN_EMAIL + TEST_ADMIN_PASSWORD.');
  }

  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });

  const loginBody = await loginRes.json().catch(() => ({}));
  if (!loginRes.ok) {
    throw new Error(`Login failed (${loginRes.status}): ${JSON.stringify(loginBody)}`);
  }

  const token = loginBody.token || loginBody.accessToken;
  if (!token) {
    throw new Error('Login succeeded but no token returned.');
  }

  return token;
}

async function main() {
  const token = await getToken();
  const randomId = randomUUID();

  console.log(`Testing DELETE /clients/delete with random id: ${randomId}`);

  const res = await fetch(`${BASE_URL}/clients/delete`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ id: randomId }),
  });

  const text = await res.text();
  console.log(`Status: ${res.status}`);
  console.log(`Body: ${text}`);

  if (res.status !== 404) {
    throw new Error(`Expected status 404, got ${res.status}`);
  }

  console.log('PASS: delete missing client returns 404.');
}

main().catch((error) => {
  console.error('FAIL:', error.message);
  process.exit(1);
});
