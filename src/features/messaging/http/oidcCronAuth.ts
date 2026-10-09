import { NextFunction, Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';

import { logger } from '../../../common/utils/logger';
import { ApiErrorCode } from '../../../security/errorCodes';

const client = new OAuth2Client();

export async function requireReminderCronOidc(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const audience = (process.env.REMINDER_CRON_OIDC_AUDIENCE || '').trim();
  const expectedEmail = (
    process.env.REMINDER_CRON_OIDC_SERVICE_ACCOUNT || ''
  ).trim();
  const header = String(req.headers.authorization || '');
  const token = header.toLowerCase().startsWith('bearer ')
    ? header.slice(7).trim()
    : '';

  if (!token || !audience || !expectedEmail) {
    res.status(401).json({
      error: 'Unauthorized',
      code: ApiErrorCode.UNAUTHENTICATED,
    });
    return;
  }

  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience,
    });
    const payload = ticket.getPayload();
    const email = String(payload?.email || '').toLowerCase();
    if (!payload?.email_verified || email !== expectedEmail.toLowerCase()) {
      logger.warn({
        service: 'messaging',
        event: 'cron_oidc_forbidden',
        status: 403,
      });
      res.status(403).json({
        error: 'Forbidden',
        code: ApiErrorCode.FORBIDDEN,
      });
      return;
    }
    next();
  } catch {
    res.status(401).json({
      error: 'Unauthorized',
      code: ApiErrorCode.UNAUTHENTICATED,
    });
  }
}

export function requireReminderTestTools(
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  const enabled = (process.env.REMINDER_TEST_TOOLS_ENABLED || '').toLowerCase();
  if (enabled !== 'true' && enabled !== '1') {
    res.status(404).json({ error: 'Not found', code: ApiErrorCode.NOT_FOUND });
    return;
  }
  next();
}
