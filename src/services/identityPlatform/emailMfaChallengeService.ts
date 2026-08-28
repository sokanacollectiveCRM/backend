/**
 * App-level email OTP 2FA after Identity Platform password sign-in.
 * Stores hashed codes in Cloud SQL; never logs plaintext codes.
 */
import { createHash, randomInt, randomUUID, timingSafeEqual } from 'crypto';

import { logger } from '../../common/utils/logger';
import { optionalEnv } from '../../config/env';
import { getPool } from '../../db/cloudSqlPool';
import { AuthenticationError, ValidationError } from '../../domains/errors';
import { NodemailerService } from '../emailService';

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
/** Minimum wait between MFA email sends (communicated to the client). */
export const MFA_RESEND_COOLDOWN_SEC = 60;
const RESEND_COOLDOWN_MS = MFA_RESEND_COOLDOWN_SEC * 1000;

function pepper(): string {
  return (
    optionalEnv('MFA_OTP_PEPPER') ??
    optionalEnv('IDENTITY_PLATFORM_PROJECT_ID') ??
    'sokana-mfa'
  );
}

function hashValue(value: string): string {
  return createHash('sha256').update(`${pepper()}:${value}`).digest('hex');
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, 'hex');
    const bb = Buffer.from(b, 'hex');
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

export interface MfaChallengeStartResult {
  challengeId: string;
  emailHint: string;
  expiresInSec: number;
  /** Seconds until another resend is allowed (full cooldown after a send). */
  resendAvailableInSec: number;
}

export class EmailMfaChallengeService {
  private emailService = new NodemailerService();

  async startChallenge(input: {
    authUid: string;
    email: string;
    idToken: string;
  }): Promise<MfaChallengeStartResult> {
    const email = input.email.trim().toLowerCase();
    if (!email) {
      throw new ValidationError('Email is required for MFA');
    }

    const code = String(randomInt(100000, 1000000));
    const challengeId = randomUUID();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    const pool = getPool();

    await pool.query(
      `INSERT INTO public.auth_mfa_challenges
        (id, auth_uid, email, id_token_hash, code_hash, attempts, max_attempts, expires_at)
       VALUES ($1, $2, $3, $4, $5, 0, $6, $7)`,
      [
        challengeId,
        input.authUid,
        email,
        hashValue(input.idToken),
        hashValue(code),
        MAX_ATTEMPTS,
        expiresAt.toISOString(),
      ]
    );

    const subject = 'Your Sokana login code';
    const text = `Your Sokana Collective login code is ${code}.\n\nThis code expires in 10 minutes. If you did not try to sign in, you can ignore this email.`;
    const html = `<p>Your Sokana Collective login code is <strong>${code}</strong>.</p><p>This code expires in 10 minutes. If you did not try to sign in, you can ignore this email.</p>`;

    try {
      await this.emailService.sendEmail(email, subject, text, html);
    } catch (err) {
      logger.error(
        {
          context: 'EmailMfaChallengeService.startChallenge',
          authUid: input.authUid,
          errName: err instanceof Error ? err.name : undefined,
          errCode:
            err && typeof err === 'object' && 'code' in err
              ? String((err as { code?: unknown }).code)
              : undefined,
        },
        'Failed to send MFA email'
      );
      await pool.query(`DELETE FROM public.auth_mfa_challenges WHERE id = $1`, [
        challengeId,
      ]);
      throw new AuthenticationError(
        'Could not send verification email. Please try again in a moment.'
      );
    }

    logger.info(
      {
        context: 'EmailMfaChallengeService.startChallenge',
        challengeId,
        emailHint: maskEmail(email),
      },
      'MFA challenge created'
    );

    return {
      challengeId,
      emailHint: maskEmail(email),
      expiresInSec: Math.floor(OTP_TTL_MS / 1000),
      resendAvailableInSec: MFA_RESEND_COOLDOWN_SEC,
    };
  }

  async verifyChallenge(input: {
    challengeId: string;
    code: string;
    idToken: string;
  }): Promise<{ authUid: string; email: string }> {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT id, auth_uid, email, id_token_hash, code_hash, attempts, max_attempts, expires_at, consumed_at
       FROM public.auth_mfa_challenges
       WHERE id = $1`,
      [input.challengeId]
    );
    const row = rows[0];
    if (!row) {
      throw new AuthenticationError('Invalid or expired verification code');
    }
    if (row.consumed_at) {
      throw new AuthenticationError('Verification code already used');
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      throw new AuthenticationError('Verification code expired');
    }
    if (row.attempts >= row.max_attempts) {
      throw new AuthenticationError('Too many verification attempts');
    }
    if (!safeEqualHex(row.id_token_hash, hashValue(input.idToken))) {
      throw new AuthenticationError('Session mismatch; please sign in again');
    }

    const codeOk = safeEqualHex(row.code_hash, hashValue(input.code.trim()));
    if (!codeOk) {
      await pool.query(
        `UPDATE public.auth_mfa_challenges SET attempts = attempts + 1 WHERE id = $1`,
        [input.challengeId]
      );
      throw new AuthenticationError('Invalid verification code');
    }

    await pool.query(
      `UPDATE public.auth_mfa_challenges
       SET consumed_at = NOW(), attempts = attempts + 1
       WHERE id = $1 AND consumed_at IS NULL`,
      [input.challengeId]
    );

    return { authUid: row.auth_uid, email: row.email };
  }

  async resendChallenge(input: {
    challengeId: string;
    idToken: string;
  }): Promise<MfaChallengeStartResult> {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT id, auth_uid, email, id_token_hash, created_at, consumed_at, expires_at
       FROM public.auth_mfa_challenges
       WHERE id = $1`,
      [input.challengeId]
    );
    const row = rows[0];
    if (!row || row.consumed_at) {
      throw new AuthenticationError('Invalid or expired challenge');
    }
    if (!safeEqualHex(row.id_token_hash, hashValue(input.idToken))) {
      throw new AuthenticationError('Session mismatch; please sign in again');
    }
    const createdAt = new Date(row.created_at).getTime();
    const remainingMs = RESEND_COOLDOWN_MS - (Date.now() - createdAt);
    if (remainingMs > 0) {
      const waitSec = Math.max(1, Math.ceil(remainingMs / 1000));
      throw new ValidationError(
        `Please wait ${waitSec} second${waitSec === 1 ? '' : 's'} before requesting another code`
      );
    }

    // Invalidate old challenge and issue a new one
    await pool.query(
      `UPDATE public.auth_mfa_challenges SET consumed_at = NOW() WHERE id = $1`,
      [input.challengeId]
    );

    return this.startChallenge({
      authUid: row.auth_uid,
      email: row.email,
      idToken: input.idToken,
    });
  }
}
