import { NotFoundError, ValidationError } from '../../domains/errors';
import { NodemailerService } from '../emailService';
import { getFirebaseAuth } from './firebaseAdmin';

const RATE_LIMIT_MS = 2 * 60 * 1000;
const lastSentByEmail = new Map<string, number>();

export function resetEmailVerificationRateLimitForTests(): void {
  lastSentByEmail.clear();
}

function frontendBaseUrl(): string {
  return (process.env.FRONTEND_URL || 'http://localhost:3001').replace(
    /\/+$/,
    ''
  );
}

export function emailVerificationContinuePath(): string {
  return `${frontendBaseUrl()}/auth/verify-email`;
}

export async function readLiveEmailVerified(
  firebaseUid: string
): Promise<boolean> {
  const record = await getFirebaseAuth().getUser(firebaseUid);
  return Boolean(record.emailVerified);
}

export async function buildEmailVerificationUrl(
  email: string
): Promise<string> {
  const redirectTo = emailVerificationContinuePath();
  const link = await getFirebaseAuth().generateEmailVerificationLink(email, {
    url: redirectTo,
  });
  const oobCode = new URL(link).searchParams.get('oobCode');
  if (!oobCode) {
    return link;
  }
  const url = new URL(redirectTo);
  url.searchParams.set('mode', 'verifyEmail');
  url.searchParams.set('oobCode', oobCode);
  return url.toString();
}

function assertRateLimit(email: string): void {
  const key = email.trim().toLowerCase();
  const last = lastSentByEmail.get(key);
  if (last && Date.now() - last < RATE_LIMIT_MS) {
    const waitSeconds = Math.ceil((RATE_LIMIT_MS - (Date.now() - last)) / 1000);
    throw new ValidationError(
      `Please wait ${waitSeconds} seconds before requesting another verification email.`
    );
  }
  lastSentByEmail.set(key, Date.now());
}

export class EmailVerificationService {
  constructor(private emailService = new NodemailerService()) {}

  async sendVerificationEmailForUid(firebaseUid: string): Promise<void> {
    const record = await getFirebaseAuth().getUser(firebaseUid);
    if (!record.email) {
      throw new ValidationError('Account is missing an email address.');
    }
    if (record.emailVerified) {
      return;
    }
    await this.sendVerificationEmailForEmail(record.email);
  }

  async sendVerificationEmailForEmail(email: string): Promise<void> {
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      throw new ValidationError('Email is required.');
    }
    assertRateLimit(normalized);

    let record;
    try {
      record = await getFirebaseAuth().getUserByEmail(normalized);
    } catch (err: unknown) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code?: string }).code)
          : '';
      if (code === 'auth/user-not-found') {
        throw new NotFoundError('No account found for that email.');
      }
      throw err;
    }

    if (record.emailVerified) {
      return;
    }

    const verifyUrl = await buildEmailVerificationUrl(normalized);
    await this.emailService.sendEmailVerificationEmail(normalized, verifyUrl);
  }
}

export const emailVerificationService = new EmailVerificationService();
