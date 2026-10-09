/**
 * Prepares JSON fixture for Playwright email-verification E2E.
 * Requires Firebase Admin (ADC) + Identity Toolkit API key for password sign-in.
 *
 * Env (optional): scripts/dev-env/.local/dev.env, backend .env
 * - E2E_CLIENT_EMAIL / DEV_ENV_CLIENT_EMAIL
 * - E2E_CLIENT_PASSWORD / DEV_ENV_CLIENT_PASSWORD
 * - E2E_CLIENT_UID / DEV_ENV_CLIENT_UID
 * - E2E_API_BASE_URL (default http://localhost:5050)
 * - E2E_FRONTEND_URL (default http://localhost:3001) → sets FRONTEND_URL for verify links
 * - FIREBASE_WEB_API_KEY or VITE_FIREBASE_API_KEY
 * - E2E_FIXTURE_OUT (path to write JSON)
 */
import dotenv from 'dotenv';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';

import { SESSION_MAX_AGE_MS } from '../../src/security/sessionCookies';
import { buildEmailVerificationUrl } from '../../src/services/identityPlatform/emailVerificationService';
import { getFirebaseAuth } from '../../src/services/identityPlatform/firebaseAdmin';

dotenv.config();
dotenv.config({
  path: resolve(process.cwd(), 'scripts/dev-env/.local/dev.env'),
});

type Fixture = {
  apiBaseUrl: string;
  frontendBaseUrl: string;
  email: string;
  password: string;
  uid: string;
  verifyUrl: string;
  unverifiedSessionCookie: string;
  preparedAt: string;
};

async function signInWithPassword(
  email: string,
  password: string,
  apiKey: string
): Promise<string> {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    }
  );
  const body = (await res.json()) as {
    idToken?: string;
    error?: { message?: string };
  };
  if (!res.ok || !body.idToken) {
    throw new Error(
      body.error?.message || `Password sign-in failed (${res.status})`
    );
  }
  return body.idToken;
}

async function main(): Promise<void> {
  const email =
    process.env.E2E_CLIENT_EMAIL?.trim() ||
    process.env.DEV_ENV_CLIENT_EMAIL?.trim();
  const password =
    process.env.E2E_CLIENT_PASSWORD || process.env.DEV_ENV_CLIENT_PASSWORD;
  const uid =
    process.env.E2E_CLIENT_UID?.trim() ||
    process.env.DEV_ENV_CLIENT_UID?.trim();
  const apiBaseUrl = (
    process.env.E2E_API_BASE_URL || 'http://localhost:5050'
  ).replace(/\/+$/, '');
  const frontendBaseUrl = (
    process.env.E2E_FRONTEND_URL || 'http://localhost:3001'
  ).replace(/\/+$/, '');
  const apiKey =
    process.env.FIREBASE_WEB_API_KEY?.trim() ||
    process.env.VITE_FIREBASE_API_KEY?.trim();

  if (!email || !password) {
    throw new Error(
      'Set E2E_CLIENT_EMAIL and E2E_CLIENT_PASSWORD (or DEV_ENV_CLIENT_* in dev.env).'
    );
  }
  if (!apiKey) {
    throw new Error(
      'Set FIREBASE_WEB_API_KEY or VITE_FIREBASE_API_KEY for password sign-in.'
    );
  }

  process.env.FRONTEND_URL = frontendBaseUrl;

  const auth = getFirebaseAuth();
  const record = uid
    ? await auth.getUser(uid)
    : await auth.getUserByEmail(email);

  if (record.email?.toLowerCase() !== email.toLowerCase()) {
    throw new Error(
      'Resolved Firebase user email does not match fixture email.'
    );
  }

  await auth.updateUser(record.uid, { emailVerified: false });

  const outPathEarly =
    process.env.E2E_FIXTURE_OUT ||
    resolve(
      process.cwd(),
      '../sokana-crm-frontend/frontend-crm/e2e/.fixtures/email-verification.json'
    );
  const skipVerifyLink = process.env.E2E_SKIP_VERIFY_LINK === '1';
  let verifyUrl: string;
  if (skipVerifyLink && existsSync(outPathEarly)) {
    verifyUrl = (
      JSON.parse(readFileSync(outPathEarly, 'utf8')) as { verifyUrl: string }
    ).verifyUrl;
  } else {
    verifyUrl = await buildEmailVerificationUrl(email);
  }
  const idToken = await signInWithPassword(email, password, apiKey);
  const sessionCookie = await auth.createSessionCookie(idToken, {
    expiresIn: SESSION_MAX_AGE_MS,
  });

  const fixture: Fixture = {
    apiBaseUrl,
    frontendBaseUrl,
    email,
    password,
    uid: record.uid,
    verifyUrl,
    unverifiedSessionCookie: sessionCookie,
    preparedAt: new Date().toISOString(),
  };

  const outPath = outPathEarly;
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(fixture, null, 2));
  // eslint-disable-next-line no-console
  console.log(`Wrote email verification E2E fixture → ${outPath}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
