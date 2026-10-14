import { getFirebaseAuth } from './firebaseAdmin';

/** One-time setup for the identity already provisioned by the admin invite. */
export async function buildStaffPasswordSetupUrl(
  email: string
): Promise<string> {
  const base = (process.env.FRONTEND_URL || 'http://localhost:3001').replace(
    /\/+$/,
    ''
  );
  const target = new URL(`${base}/signup`);
  const link = await getFirebaseAuth().generatePasswordResetLink(email, {
    url: `${base}/login`,
  });
  const code = new URL(link).searchParams.get('oobCode');
  if (!code) throw new Error('Could not create a secure invitation link.');
  target.searchParams.set('oobCode', code);
  return target.toString();
}
