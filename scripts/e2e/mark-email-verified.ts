import dotenv from 'dotenv';
import { resolve } from 'path';

import { getFirebaseAuth } from '../../src/services/identityPlatform/firebaseAdmin';

dotenv.config();
dotenv.config({
  path: resolve(process.cwd(), 'scripts/dev-env/.local/dev.env'),
});

async function main(): Promise<void> {
  const email =
    process.env.E2E_CLIENT_EMAIL?.trim() ||
    process.env.DEV_ENV_CLIENT_EMAIL?.trim();
  const uid =
    process.env.E2E_CLIENT_UID?.trim() ||
    process.env.DEV_ENV_CLIENT_UID?.trim();
  if (!email && !uid) {
    throw new Error('Set E2E_CLIENT_EMAIL or E2E_CLIENT_UID');
  }
  const auth = getFirebaseAuth();
  const user = uid
    ? await auth.getUser(uid)
    : await auth.getUserByEmail(email!);
  await auth.updateUser(user.uid, { emailVerified: true });
  // eslint-disable-next-line no-console
  console.log(`Marked ${user.email} as emailVerified=true`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
