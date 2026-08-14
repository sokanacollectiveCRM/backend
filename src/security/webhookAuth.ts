/**
 * Express middleware: provider webhook authentication (no CRM session).
 * Production fails closed when secrets are missing. Non-production allows
 * unsigned traffic only when the corresponding secret env is unset (local/dev).
 */
import { NextFunction, Request, RequestHandler, Response } from 'express';

import { logger } from '../common/utils/logger';
import { IS_PRODUCTION } from '../config/env';
import {
  getRawBodyBuffer,
  isWebhookTimestampFresh,
  verifyIntuitSignature,
  verifySignNowSignature,
} from './webhookCrypto';

const WEBHOOK_MAX_AGE_MS = 15 * 60 * 1000; // 15 minutes

function unauthorized(res: Response): void {
  res.status(401).json({ error: 'Unauthorized' });
}

function trimEnv(name: string): string {
  const value = process.env[name];
  return value && String(value).trim() ? String(value).trim() : '';
}

function resolveSignNowSecret(): string {
  return (
    trimEnv('SIGNNOW_WEBHOOK_SECRET') || trimEnv('SIGNNOW_BASIC_AUTH_TOKEN')
  );
}

function resolveQuickBooksVerifier(): string {
  return (
    trimEnv('QB_WEBHOOK_VERIFIER_TOKEN') ||
    trimEnv('INTUIT_WEBHOOK_VERIFIER_TOKEN')
  );
}

function mustEnforce(secret: string): boolean {
  return IS_PRODUCTION || Boolean(secret);
}

export const requireSignNowWebhookAuth: RequestHandler = (req, res, next) => {
  try {
    const secret = resolveSignNowSecret();
    if (!mustEnforce(secret)) {
      next();
      return;
    }
    if (!secret) {
      logger.error(
        { service: 'signnow', operation: 'webhook_auth' },
        'SignNow webhook secret not configured'
      );
      unauthorized(res);
      return;
    }

    const rawBody = getRawBodyBuffer(req);
    if (!rawBody) {
      unauthorized(res);
      return;
    }

    const signature =
      (req.get('x-signnow-signature') as string | undefined) ??
      (req.headers['x-signnow-signature'] as string | undefined);

    if (!verifySignNowSignature(rawBody, signature, secret)) {
      unauthorized(res);
      return;
    }

    next();
  } catch {
    unauthorized(res);
  }
};

export const requireQuickBooksWebhookAuth: RequestHandler = (
  req,
  res,
  next
) => {
  try {
    const verifier = resolveQuickBooksVerifier();
    if (!mustEnforce(verifier)) {
      next();
      return;
    }
    if (!verifier) {
      logger.error(
        { service: 'quickbooks', operation: 'webhook_auth' },
        'QuickBooks webhook verifier token not configured'
      );
      unauthorized(res);
      return;
    }

    const rawBody = getRawBodyBuffer(req);
    if (!rawBody) {
      unauthorized(res);
      return;
    }

    const signature =
      (req.get('intuit-signature') as string | undefined) ??
      (req.headers['intuit-signature'] as string | undefined);

    if (!verifyIntuitSignature(rawBody, signature, verifier)) {
      unauthorized(res);
      return;
    }

    const createdTime =
      (req.get('intuit-created-time') as string | undefined) ??
      (req.headers['intuit-created-time'] as string | undefined);

    if (!isWebhookTimestampFresh(createdTime, WEBHOOK_MAX_AGE_MS)) {
      unauthorized(res);
      return;
    }

    next();
  } catch {
    unauthorized(res);
  }
};

/** Exported for unit tests. */
export const webhookAuthInternals = {
  resolveSignNowSecret,
  resolveQuickBooksVerifier,
  mustEnforce,
  WEBHOOK_MAX_AGE_MS,
};
