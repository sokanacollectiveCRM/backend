import { type AuthRequest, ROLE } from '../types';

export function roleRequiresVerifiedEmail(
  role: ROLE | string | undefined
): boolean {
  const normalized = String(role || '').toLowerCase();
  return normalized === ROLE.DOULA || normalized === ROLE.CLIENT;
}

/** Paths that stay reachable before inbox verification (doula + client). */
export function isEmailVerificationExemptPath(path: string): boolean {
  const normalized = path.split('?')[0];
  const exempt = [
    '/auth/me',
    '/auth/logout',
    '/auth/send-email-verification',
    '/auth/email-verification/post-password-setup',
  ];
  return exempt.some(
    (entry) => normalized === entry || normalized.endsWith(entry)
  );
}

export function isEmailVerificationExemptRequest(req: AuthRequest): boolean {
  const path = (req.originalUrl || req.url || req.path || '').split('?')[0];
  return isEmailVerificationExemptPath(path);
}
