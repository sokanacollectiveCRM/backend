import { createHash } from 'crypto';

import { AuthenticationError, ValidationError } from '../../domains/errors';

/**
 * Pure helpers extracted for unit tests (OTP hashing / masking).
 * Challenge persistence lives in EmailMfaChallengeService.
 */
export function hashMfaValue(value: string, pepper: string): string {
  return createHash('sha256').update(`${pepper}:${value}`).digest('hex');
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

export function assertMfaCodeFormat(code: string): void {
  if (!/^\d{6}$/.test(code.trim())) {
    throw new ValidationError('code must be a 6-digit number');
  }
}

export function assertChallengeNotExpired(
  expiresAt: Date,
  now = new Date()
): void {
  if (expiresAt.getTime() < now.getTime()) {
    throw new AuthenticationError('Verification code expired');
  }
}
