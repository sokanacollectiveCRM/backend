import { createHmac } from 'crypto';

import { queryCloudSql } from '../../../db/cloudSqlPool';

export interface RateLimitStore {
  /**
   * Atomically increments a distributed counter and returns its new value.
   * Implementations must scope the counter to `windowStart`.
   */
  increment(
    key: string,
    windowStart: Date,
    expiresAt: Date,
    windowSeconds: number
  ): Promise<number>;
}

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
}

export interface SigningRateLimitInput {
  invitationId: string;
  tokenFingerprint: string;
  networkAddress?: string | null;
}

export class PostgresRateLimitStore implements RateLimitStore {
  async increment(
    key: string,
    windowStart: Date,
    expiresAt: Date,
    windowSeconds: number
  ): Promise<number> {
    const { rows } = await queryCloudSql<{ hit_count: number | string }>(
      `INSERT INTO public.signing_rate_limits
         (bucket_key, window_started_at, window_seconds, hit_count, expires_at)
       VALUES ($1, $2, $3, 1, $4)
       ON CONFLICT (bucket_key, window_started_at)
       DO UPDATE SET
         hit_count = public.signing_rate_limits.hit_count + 1,
         expires_at = GREATEST(public.signing_rate_limits.expires_at, EXCLUDED.expires_at),
         updated_at = CURRENT_TIMESTAMP
       RETURNING hit_count`,
      [key, windowStart, windowSeconds, expiresAt]
    );
    return Number(rows[0]?.hit_count ?? 1);
  }
}

export class RateLimitExceededError extends Error {
  readonly statusCode = 429;

  constructor(readonly retryAfterSeconds: number) {
    super('Too many requests');
  }
}

export class RateLimitService {
  constructor(
    private readonly store: RateLimitStore,
    private readonly secret: string,
    private readonly limit = 60,
    private readonly windowSeconds = 60
  ) {
    if (Buffer.byteLength(secret) < 32) {
      throw new Error(
        'Contract rate-limit HMAC secret must be at least 32 bytes'
      );
    }
  }

  /**
   * Uses only irreversible/HMAC identifiers. Raw invitation tokens and network
   * addresses must never be passed to the distributed store or logs.
   */
  async consume(input: SigningRateLimitInput): Promise<RateLimitDecision> {
    const now = Date.now();
    const windowMs = this.windowSeconds * 1000;
    const windowStartMs = Math.floor(now / windowMs) * windowMs;
    const windowStart = new Date(windowStartMs);
    const expiresAt = new Date(windowStartMs + windowMs * 2);
    const networkBucket = this.networkBucket(input.networkAddress);
    const keys = [
      `invitation:${input.invitationId}`,
      `token:${input.tokenFingerprint}`,
      `network:${networkBucket}`,
    ];

    const counts = await Promise.all(
      keys.map((key) =>
        this.store.increment(key, windowStart, expiresAt, this.windowSeconds)
      )
    );
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((windowStartMs + windowMs - now) / 1000)
    );

    return {
      allowed: counts.every((count) => count <= this.limit),
      retryAfterSeconds,
    };
  }

  async assertAllowed(input: SigningRateLimitInput): Promise<void> {
    const decision = await this.consume(input);
    if (!decision.allowed) {
      throw new RateLimitExceededError(decision.retryAfterSeconds);
    }
  }

  private networkBucket(networkAddress?: string | null): string {
    const normalized = String(networkAddress || 'unknown')
      .trim()
      .toLowerCase();
    return createHmac('sha256', this.secret).update(normalized).digest('hex');
  }
}
