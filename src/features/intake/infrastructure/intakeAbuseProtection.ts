/**
 * Public intake abuse protection (P0): rate limits, idempotency, honeypot.
 * Memory store in tests; Cloud SQL in production (multi-instance safe).
 */
import { createHash } from 'crypto';
import { NextFunction, Request, RequestHandler, Response } from 'express';

import { logger } from '../../../common/utils/logger';
import { getPool } from '../../../db/cloudSqlPool';
import { PUBLIC_INTAKE_SUCCESS_MESSAGE } from '../http/publicSubmissionContract';

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSec: number };
export type IdempotencyLookup =
  | { kind: 'miss' }
  | { kind: 'hit'; status: number; body: unknown }
  | { kind: 'claimed' };

export interface IntakeAbuseStore {
  hitRateLimit(
    bucketKey: string,
    limit: number,
    windowMs: number,
    now?: Date
  ): Promise<RateLimitResult>;
  lookupIdempotency(key: string, now?: Date): Promise<IdempotencyLookup>;
  claimIdempotency(
    key: string,
    ttlMs: number,
    status: number,
    body: unknown,
    now?: Date
  ): Promise<'stored' | 'conflict'>;
}

type RateRow = { windowStartedAt: number; hitCount: number };
type IdemRow = {
  expiresAt: number;
  status: number;
  body: unknown;
  claimed: boolean;
};

export class MemoryIntakeAbuseStore implements IntakeAbuseStore {
  private readonly rates = new Map<string, RateRow>();
  private readonly idem = new Map<string, IdemRow>();

  clear(): void {
    this.rates.clear();
    this.idem.clear();
  }

  async hitRateLimit(
    bucketKey: string,
    limit: number,
    windowMs: number,
    now: Date = new Date()
  ): Promise<RateLimitResult> {
    const nowMs = now.getTime();
    const existing = this.rates.get(bucketKey);
    if (!existing || nowMs - existing.windowStartedAt >= windowMs) {
      this.rates.set(bucketKey, { windowStartedAt: nowMs, hitCount: 1 });
      return { allowed: true };
    }
    if (existing.hitCount >= limit) {
      const retryAfterSec = Math.max(
        1,
        Math.ceil((existing.windowStartedAt + windowMs - nowMs) / 1000)
      );
      return { allowed: false, retryAfterSec };
    }
    existing.hitCount += 1;
    return { allowed: true };
  }

  async lookupIdempotency(
    key: string,
    now: Date = new Date()
  ): Promise<IdempotencyLookup> {
    const row = this.idem.get(key);
    if (!row) return { kind: 'miss' };
    if (row.expiresAt <= now.getTime()) {
      this.idem.delete(key);
      return { kind: 'miss' };
    }
    if (!row.claimed) return { kind: 'claimed' };
    return { kind: 'hit', status: row.status, body: row.body };
  }

  async claimIdempotency(
    key: string,
    ttlMs: number,
    status: number,
    body: unknown,
    now: Date = new Date()
  ): Promise<'stored' | 'conflict'> {
    const existing = await this.lookupIdempotency(key, now);
    if (existing.kind === 'hit' || existing.kind === 'claimed')
      return 'conflict';
    this.idem.set(key, {
      expiresAt: now.getTime() + ttlMs,
      status,
      body,
      claimed: true,
    });
    return 'stored';
  }
}

export class DbIntakeAbuseStore implements IntakeAbuseStore {
  async hitRateLimit(
    bucketKey: string,
    limit: number,
    windowMs: number,
    now: Date = new Date()
  ): Promise<RateLimitResult> {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query<{
        window_started_at: Date;
        hit_count: number;
      }>(
        `SELECT window_started_at, hit_count
         FROM public.intake_rate_limits
         WHERE bucket_key = $1
         FOR UPDATE`,
        [bucketKey]
      );

      const nowMs = now.getTime();
      if (!rows[0] || nowMs - rows[0].window_started_at.getTime() >= windowMs) {
        await client.query(
          `INSERT INTO public.intake_rate_limits (bucket_key, window_started_at, hit_count)
           VALUES ($1, $2, 1)
           ON CONFLICT (bucket_key)
           DO UPDATE SET window_started_at = EXCLUDED.window_started_at, hit_count = 1`,
          [bucketKey, now.toISOString()]
        );
        await client.query('COMMIT');
        return { allowed: true };
      }

      if (rows[0].hit_count >= limit) {
        await client.query('COMMIT');
        const retryAfterSec = Math.max(
          1,
          Math.ceil(
            (rows[0].window_started_at.getTime() + windowMs - nowMs) / 1000
          )
        );
        return { allowed: false, retryAfterSec };
      }

      await client.query(
        `UPDATE public.intake_rate_limits
         SET hit_count = hit_count + 1
         WHERE bucket_key = $1`,
        [bucketKey]
      );
      await client.query('COMMIT');
      return { allowed: true };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async lookupIdempotency(
    key: string,
    now: Date = new Date()
  ): Promise<IdempotencyLookup> {
    const pool = getPool();
    const { rows } = await pool.query<{
      expires_at: Date;
      response_status: number;
      response_body: unknown;
    }>(
      `SELECT expires_at, response_status, response_body
       FROM public.intake_idempotency_keys
       WHERE idempotency_key = $1`,
      [key]
    );
    if (!rows[0]) return { kind: 'miss' };
    if (rows[0].expires_at.getTime() <= now.getTime()) {
      await pool.query(
        `DELETE FROM public.intake_idempotency_keys WHERE idempotency_key = $1`,
        [key]
      );
      return { kind: 'miss' };
    }
    return {
      kind: 'hit',
      status: rows[0].response_status,
      body: rows[0].response_body,
    };
  }

  async claimIdempotency(
    key: string,
    ttlMs: number,
    status: number,
    body: unknown,
    now: Date = new Date()
  ): Promise<'stored' | 'conflict'> {
    const pool = getPool();
    const expiresAt = new Date(now.getTime() + ttlMs);
    const result = await pool.query(
      `INSERT INTO public.intake_idempotency_keys
         (idempotency_key, expires_at, response_status, response_body)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING idempotency_key`,
      [key, expiresAt.toISOString(), status, JSON.stringify(body)]
    );
    return result.rowCount && result.rowCount > 0 ? 'stored' : 'conflict';
  }
}

const memoryStoreSingleton = new MemoryIntakeAbuseStore();

function shouldUseMemoryStore(): boolean {
  if (process.env.INTAKE_ABUSE_STORE === 'db') return false;
  if (process.env.INTAKE_ABUSE_STORE === 'memory') return true;
  // Jest worker id stays set even if dotenv later overwrites NODE_ENV.
  if (process.env.JEST_WORKER_ID) return true;
  return process.env.NODE_ENV === 'test';
}

let store: IntakeAbuseStore = shouldUseMemoryStore()
  ? memoryStoreSingleton
  : new DbIntakeAbuseStore();

export function getIntakeAbuseStore(): IntakeAbuseStore {
  if (shouldUseMemoryStore()) {
    if (!(store instanceof MemoryIntakeAbuseStore)) {
      store = memoryStoreSingleton;
    }
    return store;
  }
  if (store instanceof MemoryIntakeAbuseStore) {
    store = new DbIntakeAbuseStore();
  }
  return store;
}

export function setIntakeAbuseStoreForTests(next: IntakeAbuseStore): void {
  store = next;
}

export function resetIntakeAbuseStoreForTests(): void {
  memoryStoreSingleton.clear();
  store = shouldUseMemoryStore()
    ? memoryStoreSingleton
    : new DbIntakeAbuseStore();
}

/**
 * Rate limits + soft dedupe are off in Jest unless `INTAKE_ABUSE_ENFORCE=true`
 * so suite volume does not trip shared in-memory buckets. Honeypot + Idempotency-Key stay on.
 */
export function isIntakeAbuseEnforced(): boolean {
  if (process.env.INTAKE_ABUSE_ENFORCE === 'true') return true;
  if (process.env.INTAKE_ABUSE_ENFORCE === 'false') return false;
  if (process.env.JEST_WORKER_ID) return false;
  return process.env.NODE_ENV !== 'test';
}

export function getIntakeAbuseConfig() {
  return {
    ipMax: Math.max(
      1,
      parseInt(process.env.INTAKE_RATE_LIMIT_IP_MAX || '10', 10)
    ),
    emailMax: Math.max(
      1,
      parseInt(process.env.INTAKE_RATE_LIMIT_EMAIL_MAX || '3', 10)
    ),
    windowMs: Math.max(
      1000,
      parseInt(
        process.env.INTAKE_RATE_LIMIT_WINDOW_MS || `${60 * 60 * 1000}`,
        10
      )
    ),
    idempotencyTtlMs: Math.max(
      60_000,
      parseInt(
        process.env.INTAKE_IDEMPOTENCY_TTL_MS || `${24 * 60 * 60 * 1000}`,
        10
      )
    ),
    softDedupeWindowMs: Math.max(
      1000,
      parseInt(
        process.env.INTAKE_SOFT_DEDUPE_WINDOW_MS || `${5 * 60 * 1000}`,
        10
      )
    ),
  };
}

const HONEYPOT_FIELDS = [
  'website',
  'company_url',
  'fax_number',
  'hp_field',
] as const;

export function isIntakeHoneypotTriggered(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;
  const record = body as Record<string, unknown>;
  return HONEYPOT_FIELDS.some((field) => {
    const value = record[field];
    return typeof value === 'string' && value.trim().length > 0;
  });
}

export function extractClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return String(forwarded[0]).split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

export function normalizeIntakeEmail(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const email = (body as Record<string, unknown>).email;
  if (typeof email !== 'string') return null;
  const trimmed = email.trim().toLowerCase();
  return trimmed.includes('@') ? trimmed : null;
}

export function readIdempotencyKey(req: Request): string | null {
  const header =
    (req.get('idempotency-key') as string | undefined) ||
    (req.headers['idempotency-key'] as string | undefined);
  if (!header || typeof header !== 'string') return null;
  const key = header.trim();
  if (!key || key.length > 128) return null;
  return key;
}

export function buildSoftDedupeKey(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  const email = normalizeIntakeEmail(body);
  if (!email) return null;
  const first =
    typeof record.firstname === 'string'
      ? record.firstname.trim().toLowerCase()
      : '';
  const last =
    typeof record.lastname === 'string'
      ? record.lastname.trim().toLowerCase()
      : '';
  const service =
    typeof record.service_needed === 'string'
      ? record.service_needed.trim().toLowerCase()
      : '';
  const digest = createHash('sha256')
    .update(`${email}|${first}|${last}|${service}`)
    .digest('hex')
    .slice(0, 32);
  return `soft:${digest}`;
}

function tooManyRequests(res: Response, retryAfterSec: number): void {
  res.setHeader('Retry-After', String(retryAfterSec));
  res.status(429).json({
    error: 'Too many requests. Please try again later.',
    code: 'RATE_LIMITED',
  });
}

/**
 * Early middleware: honeypot + IP rate limit.
 * Email rate limit / idempotency run in the controller helper (needs body email).
 */
export const protectPublicIntakeEarly: RequestHandler = async (
  req,
  res,
  next
) => {
  try {
    if (isIntakeHoneypotTriggered(req.body)) {
      logger.info(
        { service: 'intake', operation: 'honeypot_block', path: req.path },
        'Intake honeypot triggered'
      );
      res.status(200).json({ message: PUBLIC_INTAKE_SUCCESS_MESSAGE });
      return;
    }

    if (isIntakeAbuseEnforced()) {
      const config = getIntakeAbuseConfig();
      const ip = extractClientIp(req);
      const ipResult = await getIntakeAbuseStore().hitRateLimit(
        `ip:${ip}`,
        config.ipMax,
        config.windowMs
      );
      if (ipResult.allowed === false) {
        logger.info(
          {
            service: 'intake',
            operation: 'rate_limit_ip',
            retryAfterSec: ipResult.retryAfterSec,
          },
          'Intake IP rate limited'
        );
        tooManyRequests(res, ipResult.retryAfterSec);
        return;
      }
    }

    next();
  } catch (error) {
    logger.error(
      {
        service: 'intake',
        operation: 'abuse_early',
        err: error instanceof Error ? error.name : 'error',
      },
      'Intake abuse early check failed open to validation path'
    );
    next();
  }
};

export type IntakeGuardDecision =
  | { action: 'proceed' }
  | { action: 'replay'; status: number; body: unknown }
  | { action: 'rate_limited'; retryAfterSec: number }
  | { action: 'soft_dedupe' };

/**
 * Email rate limit + Idempotency-Key + soft email dedupe.
 * Call before persisting a lead; on success call `finalizeIntakeIdempotency`.
 */
export async function evaluateIntakeSubmissionGuards(
  req: Request,
  body: unknown
): Promise<IntakeGuardDecision> {
  const config = getIntakeAbuseConfig();
  const abuseStore = getIntakeAbuseStore();
  const enforced = isIntakeAbuseEnforced();

  // Replay / soft-dedupe before email rate limit so retries do not burn the bucket.
  const idemKey = readIdempotencyKey(req);
  if (idemKey) {
    const existing = await abuseStore.lookupIdempotency(idemKey);
    if (existing.kind === 'hit') {
      return { action: 'replay', status: existing.status, body: existing.body };
    }
  }

  if (enforced) {
    const softKey = buildSoftDedupeKey(body);
    if (softKey) {
      const soft = await abuseStore.lookupIdempotency(softKey);
      if (soft.kind === 'hit') {
        return { action: 'soft_dedupe' };
      }
    }

    const email = normalizeIntakeEmail(body);
    if (email) {
      const emailResult = await abuseStore.hitRateLimit(
        `email:${email}`,
        config.emailMax,
        config.windowMs
      );
      if (emailResult.allowed === false) {
        return {
          action: 'rate_limited',
          retryAfterSec: emailResult.retryAfterSec,
        };
      }
    }
  }

  return { action: 'proceed' };
}

export async function finalizeIntakeIdempotency(
  req: Request,
  body: unknown,
  status: number,
  responseBody: unknown
): Promise<void> {
  const config = getIntakeAbuseConfig();
  const abuseStore = getIntakeAbuseStore();
  const idemKey = readIdempotencyKey(req);
  if (idemKey) {
    await abuseStore.claimIdempotency(
      idemKey,
      config.idempotencyTtlMs,
      status,
      responseBody
    );
  }
  if (isIntakeAbuseEnforced()) {
    const softKey = buildSoftDedupeKey(body);
    if (softKey && status >= 200 && status < 300) {
      await abuseStore.claimIdempotency(
        softKey,
        config.softDedupeWindowMs,
        status,
        responseBody
      );
    }
  }
}

export function sendIntakeRateLimited(
  res: Response,
  retryAfterSec: number
): void {
  tooManyRequests(res, retryAfterSec);
}

export function sendIntakeSoftDedupe(res: Response): void {
  res.status(200).json({ message: PUBLIC_INTAKE_SUCCESS_MESSAGE });
}

/** Express helper unused but keeps NextFunction typed for future composition. */
export type _IntakeNext = NextFunction;
