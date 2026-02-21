import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = (process.env.API_BASE_URL || process.env.API_URL || process.env.BACKEND_URL || 'http://localhost:5050').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || '';
const CLIENT_ID = process.env.PROFILE_TEST_CLIENT_ID || '';
const PROVIDED_TOKEN = process.env.PROFILE_TEST_TOKEN || '';

function getData<T = any>(body: any): T {
  if (body && typeof body === 'object' && 'data' in body) return body.data as T;
  return body as T;
}

async function getToken(): Promise<string> {
  if (PROVIDED_TOKEN) return PROVIDED_TOKEN;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error('Missing auth. Set PROFILE_TEST_TOKEN or TEST_ADMIN_EMAIL + TEST_ADMIN_PASSWORD.');
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
  if (!token) throw new Error('Login succeeded but no token returned.');
  return token;
}

async function main() {
  if (!CLIENT_ID) {
    throw new Error('Missing PROFILE_TEST_CLIENT_ID');
  }
  const token = await getToken();
  const suffix = Date.now().toString();
  const updatePayload = {
    bio: `Profile bio test ${suffix}`,
    city: `Chicago ${suffix.slice(-4)}`,
    state: 'Illinois',
    zipCode: `6060${suffix.slice(-1)}`,
    country: 'USA',
  };

  const beforeRes = await fetch(`${BASE_URL}/clients/${CLIENT_ID}?detailed=true`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const beforeBody = await beforeRes.json().catch(() => ({}));
  console.log('Before GET status:', beforeRes.status);
  console.log('Before GET body:', JSON.stringify(beforeBody));

  const updateRes = await fetch(`${BASE_URL}/clients/${CLIENT_ID}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(updatePayload),
  });
  const updateBody = await updateRes.json().catch(() => ({}));
  console.log('Update status:', updateRes.status);
  console.log('Update body:', JSON.stringify(updateBody));
  if (!updateRes.ok) {
    throw new Error(`Update failed with status ${updateRes.status}`);
  }

  const afterRes = await fetch(`${BASE_URL}/clients/${CLIENT_ID}?detailed=true`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const afterBody = await afterRes.json().catch(() => ({}));
  console.log('After GET status:', afterRes.status);
  console.log('After GET body:', JSON.stringify(afterBody));
  if (!afterRes.ok) {
    throw new Error(`After fetch failed with status ${afterRes.status}`);
  }

  const data = getData<any>(afterBody);
  const checks: Array<[string, string]> = [
    ['bio', updatePayload.bio],
    ['city', updatePayload.city],
    ['state', updatePayload.state],
    ['zipCode', updatePayload.zipCode],
    ['country', updatePayload.country],
  ];
  for (const [key, expected] of checks) {
    if ((data?.[key] ?? null) !== expected) {
      throw new Error(`Assertion failed for ${key}: expected "${expected}", got "${String(data?.[key])}"`);
    }
  }

  console.log('PASS: profile/address fields persisted and returned correctly.');
}

main().catch((error) => {
  console.error('FAIL:', error.message);
  process.exit(1);
});
