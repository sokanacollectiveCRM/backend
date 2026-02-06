/**
 * HMAC Signature Verification for Service-to-Service Auth
 * 
 * Security:
 * - Verifies X-Sokana-Timestamp header (reject if > 5 minutes old)
 * - Verifies X-Sokana-Signature header (HMAC-SHA256)
 * - Signature = HMAC-SHA256(timestamp + "." + rawBodyString)
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { ResponseBuilder } from '../utils/responseBuilder';

const MAX_TIMESTAMP_AGE_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Express middleware to verify HMAC signature on incoming requests.
 */
export function verifySignature(req: Request, res: Response, next: NextFunction): void {
  const sharedSecret = process.env.PHI_BROKER_SHARED_SECRET;
  
  if (!sharedSecret) {
    console.error('[Auth] PHI_BROKER_SHARED_SECRET not configured');
    res.status(500).json(ResponseBuilder.error('Server misconfigured', 'CONFIG_ERROR'));
    return;
  }

  // Extract headers
  const timestamp = req.headers['x-sokana-timestamp'] as string | undefined;
  const signature = req.headers['x-sokana-signature'] as string | undefined;

  // Validate headers exist
  if (!timestamp || !signature) {
    // Log metadata only - no sensitive data
    console.warn('[Auth] Missing auth headers', {
      hasTimestamp: !!timestamp,
      hasSignature: !!signature,
    });
    res.status(401).json(ResponseBuilder.error('Unauthorized', 'UNAUTHORIZED'));
    return;
  }

  // Validate timestamp is not too old
  const timestampMs = parseInt(timestamp, 10);
  if (isNaN(timestampMs)) {
    console.warn('[Auth] Invalid timestamp format');
    res.status(401).json(ResponseBuilder.error('Unauthorized', 'UNAUTHORIZED'));
    return;
  }

  const now = Date.now();
  const age = now - timestampMs;

  if (age > MAX_TIMESTAMP_AGE_MS || age < -MAX_TIMESTAMP_AGE_MS) {
    // Log metadata only
    console.warn('[Auth] Timestamp out of range', { age, maxAge: MAX_TIMESTAMP_AGE_MS });
    res.status(401).json(ResponseBuilder.error('Unauthorized', 'UNAUTHORIZED'));
    return;
  }

  // Compute expected signature
  // Body was captured as raw string by express.json() with verify option
  const rawBody = (req as any).rawBody as string;
  if (typeof rawBody !== 'string') {
    console.error('[Auth] rawBody not captured - middleware misconfigured');
    res.status(500).json(ResponseBuilder.error('Server misconfigured', 'CONFIG_ERROR'));
    return;
  }

  const signaturePayload = `${timestamp}.${rawBody}`;
  const expectedSignature = createHmac('sha256', sharedSecret)
    .update(signaturePayload)
    .digest('hex');

  // Timing-safe comparison to prevent timing attacks
  const signatureBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');

  if (signatureBuffer.length !== expectedBuffer.length) {
    console.warn('[Auth] Signature length mismatch');
    res.status(401).json(ResponseBuilder.error('Unauthorized', 'UNAUTHORIZED'));
    return;
  }

  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
    console.warn('[Auth] Signature mismatch');
    res.status(401).json(ResponseBuilder.error('Unauthorized', 'UNAUTHORIZED'));
    return;
  }

  // Signature valid
  next();
}

/**
 * Express body parser options to capture raw body for signature verification.
 * Use with express.json({ verify: captureRawBody })
 */
export function captureRawBody(
  req: Request,
  _res: Response,
  buf: Buffer,
  encoding: BufferEncoding
): void {
  (req as any).rawBody = buf.toString(encoding || 'utf8');
}
