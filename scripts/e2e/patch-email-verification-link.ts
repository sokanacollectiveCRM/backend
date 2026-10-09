/**
 * Regenerates only the verifyUrl in the Playwright fixture (one Firebase link per run).
 */
import dotenv from 'dotenv';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

import { getFirebaseAuth } from '../../src/services/identityPlatform/firebaseAdmin';

dotenv.config();
dotenv.config({
  path: resolve(process.cwd(), 'scripts/dev-env/.local/dev.env'),
});

async function main(): Promise<void> {
  const outPath =
    process.env.E2E_FIXTURE_OUT ||
    resolve(
      process.cwd(),
      '../sokana-crm-frontend/frontend-crm/e2e/.fixtures/email-verification.json'
    );
  if (!existsSync(outPath)) {
    throw new Error(
      `Fixture not found: ${outPath}. Run prepare-email-verification-fixture first.`
    );
  }
  const fixture = JSON.parse(readFileSync(outPath, 'utf8')) as {
    email: string;
    verifyUrl: string;
    [key: string]: unknown;
  };
  process.env.FRONTEND_URL =
    process.env.E2E_FRONTEND_URL ||
    fixture.frontendBaseUrl ||
    'http://localhost:3001';
  const continueUrl = String(process.env.FRONTEND_URL).replace(/\/+$/, '');
  const rawLink = await getFirebaseAuth().generateEmailVerificationLink(
    fixture.email,
    { url: `${continueUrl}/auth/verify-email` }
  );
  const oobCode = new URL(rawLink).searchParams.get('oobCode');
  fixture.verifyUrl = oobCode
    ? `${continueUrl}/auth/verify-email?mode=verifyEmail&oobCode=${encodeURIComponent(oobCode)}`
    : rawLink;
  (fixture as { rawVerifyLink?: string }).rawVerifyLink = rawLink;
  writeFileSync(outPath, JSON.stringify(fixture, null, 2));
  // eslint-disable-next-line no-console
  console.log('Patched verifyUrl in fixture.');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
