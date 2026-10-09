import { NextFunction, Request, Response } from 'express';

import { OAuth2Client, TokenPayload } from 'google-auth-library';

import { logger } from '../../../common/utils/logger';

export type OidcVerifier = (token: string) => Promise<TokenPayload | null>;

function readBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (typeof header !== 'string') return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export function createGoogleOidcVerifier(): OidcVerifier {
  const client = new OAuth2Client();
  return async (token: string) => {
    const audience = process.env.REMINDER_CRON_OIDC_AUDIENCE;
    if (!audience) return null;
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience,
    });
    return ticket.getPayload() ?? null;
  };
}

export function requireReminderCronOidc(
  verify: OidcVerifier = createGoogleOidcVerifier()
) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const expectedAud = process.env.REMINDER_CRON_OIDC_AUDIENCE;
    const expectedEmail = process.env.REMINDER_CRON_OIDC_SERVICE_ACCOUNT;
    if (!expectedAud || !expectedEmail) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const token = readBearer(req);
    if (!token) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    try {
      const payload = await verify(token);
      if (!payload) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const audiences = Array.isArray(payload.aud)
        ? payload.aud
        : [payload.aud];
      if (!audiences.includes(expectedAud)) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      const email = String(payload.email || '').toLowerCase();
      if (
        email !== expectedEmail.toLowerCase() ||
        payload.email_verified === false
      ) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      next();
    } catch (error) {
      logger.warn(
        {
          operation: 'reminders_tick_oidc',
          errorClass: error instanceof Error ? error.name : 'unknown',
        },
        'Reminder tick OIDC verification failed'
      );
      res.status(401).json({ error: 'Unauthorized' });
    }
  };
}
