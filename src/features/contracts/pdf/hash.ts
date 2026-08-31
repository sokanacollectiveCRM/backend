import { createHash, timingSafeEqual } from 'crypto';

const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export function assertSha256(value: string, label = 'SHA-256'): void {
  if (!SHA256_PATTERN.test(value)) {
    throw new Error(`${label} must be a lowercase 64-character SHA-256`);
  }
}

export function verifySha256(
  bytes: Uint8Array,
  expected: string,
  label = 'content'
): void {
  assertSha256(expected, `${label} hash`);
  const actual = sha256(bytes);
  if (
    !timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'))
  ) {
    throw new Error(`${label} hash mismatch`);
  }
}
