/**
 * Provider webhook HMAC helpers (SignNow + Intuit QuickBooks).
 * Never logs secrets, signatures, or raw payloads.
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { Request, Response } from 'express';

export type RawBodyRequest = Request & { rawBody?: Buffer | string };

export function captureRawBody(
  req: Request,
  _res: Response,
  buf: Buffer,
  _encoding: string,
): void {
  try {
    (req as RawBodyRequest).rawBody = Buffer.isBuffer(buf) ? Buffer.from(buf) : Buffer.alloc(0);
  } catch {
    (req as RawBodyRequest).rawBody = Buffer.alloc(0);
  }
}

export function getRawBodyBuffer(req: Request): Buffer | null {
  const raw = (req as RawBodyRequest).rawBody;
  if (Buffer.isBuffer(raw)) return raw;
  if (typeof raw === 'string') return Buffer.from(raw, 'utf8');
  return null;
}

export function safeEqualString(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function hmacSha256Base64(secret: string, payload: Buffer | string): string {
  return createHmac('sha256', secret).update(payload).digest('base64');
}

export function hmacSha256Hex(secret: string, payload: Buffer | string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/** Intuit: base64(HMAC-SHA256(rawBody, verifierToken)) vs `intuit-signature`. */
export function verifyIntuitSignature(
  rawBody: Buffer | string,
  signatureHeader: string | undefined,
  verifierToken: string,
): boolean {
  if (!signatureHeader || !verifierToken) return false;
  const expected = hmacSha256Base64(verifierToken, rawBody);
  return safeEqualString(expected, signatureHeader.trim());
}

/**
 * SignNow: HMAC-SHA256 of raw body with subscription secret_key.
 * Header: `X-SignNow-Signature`. Accept base64 or hex encodings used in the wild.
 */
export function verifySignNowSignature(
  rawBody: Buffer | string,
  signatureHeader: string | undefined,
  secret: string,
): boolean {
  if (!signatureHeader || !secret) return false;
  const provided = signatureHeader.trim();
  const expectedBase64 = hmacSha256Base64(secret, rawBody);
  const expectedHex = hmacSha256Hex(secret, rawBody);
  return safeEqualString(expectedBase64, provided) || safeEqualString(expectedHex, provided);
}

/** Parse Intuit `intuit-created-time` (ISO) and reject outside skew window. */
export function isWebhookTimestampFresh(
  createdTimeHeader: string | undefined,
  maxAgeMs: number,
  nowMs: number = Date.now(),
): boolean {
  if (!createdTimeHeader || typeof createdTimeHeader !== 'string') {
    // Header optional: rely on event-key idempotency when absent.
    return true;
  }
  const createdMs = Date.parse(createdTimeHeader);
  if (!Number.isFinite(createdMs)) return false;
  const age = nowMs - createdMs;
  return age <= maxAgeMs && age >= -maxAgeMs;
}
