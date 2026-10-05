import { queryCloudSql } from '../../../db/cloudSqlPool';
import { RateLimitStore } from '../application/rateLimitService';

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
