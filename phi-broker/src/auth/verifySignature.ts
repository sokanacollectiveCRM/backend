/**
 * HMAC Signature Verification for Service-to-Service Auth
 *
 * HARDENED: Never returns 500 for auth failures. Always 401 Unauthorized.
 * - X-Sokana-Timestamp (Unix ms, ±5 min)
 * - X-Sokana-Signature (HMAC-SHA256 of timestamp + "." + rawBody, hex)
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { ResponseBuilder } from '../utils/responseBuilder';

const MAX_TIMESTAMP_AGE_MS = 5 * 60 * 1000; // 5 minutes
const HMAC_HEX_LENGTH = 64; // SHA-256 digest in hex

/**
 * Send 401 Unauthorized. No details, no throw, no 500.
 */
function safeUnauthorized(res: Response): void {
  res.status(401).json(ResponseBuilder.error('Unauthorized', 'UNAUTHORIZED'));
}

/**
 * Express middleware to verify HMAC signature on incoming requests.
 * Never throws. Never returns 500 for missing/invalid auth — only 401.
 */
export function verifySignature(req: Request, res: Response, next: NextFunction): void {
  try {
    // 401 if secret not configured (treat as auth failure, not server misconfig for QA)
    const sharedSecret = process.env.PHI_BROKER_SHARED_SECRET;
    if (!sharedSecret || typeof sharedSecret !== 'string') {
      safeUnauthorized(res);
      return;
    }

    const timestamp = req.headers['x-sokana-timestamp'] as string | undefined;
    const signature = req.headers['x-sokana-signature'] as string | undefined;

    if (!timestamp || !signature) {
      safeUnauthorized(res);
      return;
    }

    const timestampMs = Number(timestamp);
    if (!Number.isFinite(timestampMs)) {
      safeUnauthorized(res);
      return;
    }

    const now = Date.now();
    const age = now - timestampMs;
    if (age > MAX_TIMESTAMP_AGE_MS || age < -MAX_TIMESTAMP_AGE_MS) {
      safeUnauthorized(res);
      return;
    }

    const rawBody = (req as any).rawBody;
    if (typeof rawBody !== 'string') {
      safeUnauthorized(res);
      return;
    }

    const signaturePayload = `${timestamp}.${rawBody}`;
    const expectedHex = createHmac('sha256', sharedSecret)
      .update(signaturePayload)
      .digest('hex');

    // Validate hex format and length before Buffer conversion
    if (typeof signature !== 'string' || signature.length !== HMAC_HEX_LENGTH) {
      safeUnauthorized(res);
      return;
    }
    if (!/^[0-9a-fA-F]+$/.test(signature)) {
      safeUnauthorized(res);
      return;
    }
    if (expectedHex.length !== HMAC_HEX_LENGTH) {
      safeUnauthorized(res);
      return;
    }

    const signatureBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedHex, 'hex');

    if (signatureBuffer.length !== expectedBuffer.length) {
      safeUnauthorized(res);
      return;
    }

    if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
      safeUnauthorized(res);
      return;
    }

    next();
  } catch (_) {
    safeUnauthorized(res);
  }
}

/**
 * Express body parser verify callback — captures raw body for signature verification.
 * Use with express.json({ verify: captureRawBody }). Never throws.
 */
export function captureRawBody(
  req: Request,
  _res: Response,
  buf: Buffer | undefined,
  encoding?: BufferEncoding
): void {
  try {
    (req as any).rawBody = buf && Buffer.isBuffer(buf) ? buf.toString(encoding || 'utf8') : '';
  } catch {
    (req as any).rawBody = '';
  }
}
