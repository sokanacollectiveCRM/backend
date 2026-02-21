import dotenv from 'dotenv';

dotenv.config();

const API_BASE_URL = (process.env.API_BASE_URL || 'http://localhost:5050').replace(/\/$/, '');
const TEST_ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || '';
const TEST_ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || '';
const PORTAL_TEST_CLIENT_ID = process.env.PORTAL_TEST_CLIENT_ID || '';

function cookieHeaderFromLoginResponse(loginRes: Response): string | null {
  const setCookie = loginRes.headers.get('set-cookie') || '';
  const tokenCookie = setCookie
    .split(',')
    .map((part) => part.trim())
    .find((part) => part.startsWith('sb-access-token='));
  return tokenCookie ? tokenCookie.split(';')[0] : null;
}

async function loginForAuthHeaders(): Promise<Record<string, string>> {
  if (!TEST_ADMIN_EMAIL || !TEST_ADMIN_PASSWORD) {
    throw new Error('Missing TEST_ADMIN_EMAIL or TEST_ADMIN_PASSWORD');
  }

  const loginRes = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: TEST_ADMIN_EMAIL,
      password: TEST_ADMIN_PASSWORD,
    }),
  });

  const loginBody = await loginRes.json().catch(() => ({} as Record<string, unknown>));
  if (!loginRes.ok) {
    throw new Error(`Login failed (${loginRes.status}): ${JSON.stringify(loginBody)}`);
  }

  const bearer = (loginBody as any).token || (loginBody as any).accessToken;
  if (typeof bearer === 'string' && bearer.length > 0) {
    return { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' };
  }

  const cookie = cookieHeaderFromLoginResponse(loginRes);
  if (cookie) {
    return { Cookie: cookie, 'Content-Type': 'application/json' };
  }

  throw new Error('Login succeeded but no bearer token or sb-access-token cookie found');
}

async function callPortalEndpoint(
  headers: Record<string, string>,
  name: string,
  path: string
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers,
  });
  const body = await res.text();
  console.log(`\n[${name}] ${res.status}`);
  console.log(body);
}

async function main() {
  if (!PORTAL_TEST_CLIENT_ID) {
    throw new Error('Missing PORTAL_TEST_CLIENT_ID');
  }

  const headers = await loginForAuthHeaders();

  await callPortalEndpoint(
    headers,
    'invite',
    `/api/admin/clients/${PORTAL_TEST_CLIENT_ID}/portal/invite`
  );

  await callPortalEndpoint(
    headers,
    'resend',
    `/api/admin/clients/${PORTAL_TEST_CLIENT_ID}/portal/resend`
  );

  await callPortalEndpoint(
    headers,
    'disable',
    `/api/admin/clients/${PORTAL_TEST_CLIENT_ID}/portal/disable`
  );
}

main().catch((error) => {
  console.error('verify_portal_invite_flow failed:', error.message);
  process.exit(1);
});
