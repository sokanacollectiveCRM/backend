import { logger } from '../../../common/utils/logger';
import { NodemailerService } from '../../../services/emailService';
import { getFirebaseAuth } from '../../../services/identityPlatform/firebaseAdmin';

export async function sendPasswordResetEmailIfAccountExists(
  rawEmail: unknown
): Promise<void> {
  const email =
    typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;

  try {
    const base = (process.env.FRONTEND_URL || 'http://localhost:3001').replace(
      /\/+$/,
      ''
    );
    const providerLink = await getFirebaseAuth().generatePasswordResetLink(
      email,
      { url: `${base}/login` }
    );
    const code = new URL(providerLink).searchParams.get('oobCode');
    if (!code)
      throw new Error('Identity Platform did not return a reset code.');
    const resetUrl = new URL(`${base}/auth/reset-password`);
    resetUrl.searchParams.set('mode', 'resetPassword');
    resetUrl.searchParams.set('oobCode', code);
    await new NodemailerService().sendEmail(
      email,
      'Reset your Sokana360 password',
      `We received a request to reset your Sokana360 password.\n\nReset your password: ${resetUrl.toString()}\n\nIf you did not request this, you can ignore this email.\n\nSokana360`
    );
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === 'auth/user-not-found') return;
    logger.error(
      {
        service: 'auth',
        operation: 'password_reset_email',
        errorCode: 'PASSWORD_RESET_EMAIL_FAILURE',
      },
      'Password reset email could not be delivered'
    );
    throw error;
  }
}
