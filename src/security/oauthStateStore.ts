/**
 * Cryptographically secure, stored, expiring, single-use OAuth state (QuickBooks).
 */
import { randomBytes } from 'crypto';

import { getPool } from '../db/cloudSqlPool';

export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const QUICKBOOKS_OAUTH_PROVIDER = 'quickbooks';

export interface OAuthStateStore {
  create(provider: string, state: string, expiresAt: Date): Promise<void>;
  /** Atomically marks unused, unexpired state as used. Returns false if missing/expired/reused. */
  consume(provider: string, state: string, now?: Date): Promise<boolean>;
}

export class MemoryOAuthStateStore implements OAuthStateStore {
  private readonly rows = new Map<
    string,
    { provider: string; expiresAt: number; usedAt: number | null }
  >();

  async create(
    provider: string,
    state: string,
    expiresAt: Date
  ): Promise<void> {
    this.rows.set(state, {
      provider,
      expiresAt: expiresAt.getTime(),
      usedAt: null,
    });
  }

  async consume(
    provider: string,
    state: string,
    now: Date = new Date()
  ): Promise<boolean> {
    const row = this.rows.get(state);
    if (!row || row.provider !== provider) return false;
    if (row.usedAt !== null) return false;
    if (row.expiresAt <= now.getTime()) return false;
    row.usedAt = now.getTime();
    return true;
  }

  clear(): void {
    this.rows.clear();
  }
}

export class DbOAuthStateStore implements OAuthStateStore {
  async create(
    provider: string,
    state: string,
    expiresAt: Date
  ): Promise<void> {
    const pool = getPool();
    await pool.query(
      `INSERT INTO public.oauth_states (state, provider, expires_at)
       VALUES ($1, $2, $3)`,
      [state, provider, expiresAt.toISOString()]
    );
  }

  async consume(
    provider: string,
    state: string,
    now: Date = new Date()
  ): Promise<boolean> {
    const pool = getPool();
    const result = await pool.query(
      `UPDATE public.oauth_states
       SET used_at = $3
       WHERE state = $1
         AND provider = $2
         AND used_at IS NULL
         AND expires_at > $3
       RETURNING state`,
      [state, provider, now.toISOString()]
    );
    return Boolean(result.rowCount && result.rowCount > 0);
  }
}

const useMemory =
  process.env.OAUTH_STATE_STORE === 'memory' ||
  (process.env.NODE_ENV === 'test' && process.env.OAUTH_STATE_STORE !== 'db');

let store: OAuthStateStore = useMemory
  ? new MemoryOAuthStateStore()
  : new DbOAuthStateStore();

export function getOAuthStateStore(): OAuthStateStore {
  return store;
}

export function setOAuthStateStoreForTests(next: OAuthStateStore): void {
  store = next;
}

export function resetOAuthStateStoreForTests(): void {
  store = useMemory ? new MemoryOAuthStateStore() : new DbOAuthStateStore();
}

export function generateOAuthStateValue(): string {
  return randomBytes(32).toString('base64url');
}

export async function createOAuthState(
  provider: string = QUICKBOOKS_OAUTH_PROVIDER,
  ttlMs: number = OAUTH_STATE_TTL_MS
): Promise<string> {
  const state = generateOAuthStateValue();
  const expiresAt = new Date(Date.now() + ttlMs);
  await getOAuthStateStore().create(provider, state, expiresAt);
  return state;
}

export async function consumeOAuthState(
  state: string | null | undefined,
  provider: string = QUICKBOOKS_OAUTH_PROVIDER
): Promise<boolean> {
  if (!state || typeof state !== 'string' || state.trim() === '') {
    return false;
  }
  return getOAuthStateStore().consume(provider, state.trim());
}
