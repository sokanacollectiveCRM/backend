/**
 * Single Cloud SQL (Postgres) connection pool for sokana_private.
 * Reads env vars; fails fast on first use if required vars are missing.
 * Supabase is used only for auth; all client data comes from this pool.
 */

import { Pool } from 'pg';

const REQUIRED = [
  'CLOUD_SQL_HOST',
  'CLOUD_SQL_DATABASE',
  'CLOUD_SQL_USER',
  'CLOUD_SQL_PASSWORD',
] as const;

function getRequiredEnv(name: string): string {
  const v = process.env[name];
  if (v === undefined || String(v).trim() === '') {
    const missing = REQUIRED.filter((key) => !process.env[key] || String(process.env[key]).trim() === '');
    throw new Error(
      `Missing required Cloud SQL env: ${missing.join(', ')}. ` +
        'Set CLOUD_SQL_HOST, CLOUD_SQL_PORT (optional, default 5432), CLOUD_SQL_DATABASE, CLOUD_SQL_USER, CLOUD_SQL_PASSWORD. ' +
        'For local dev with Cloud SQL Proxy: CLOUD_SQL_HOST=127.0.0.1 CLOUD_SQL_PORT=5433 CLOUD_SQL_DATABASE=sokana_private.'
    );
  }
  return String(v).trim();
}

let pool: Pool | null = null;

const TRANSIENT_ERROR_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'EPIPE',
  'ETIMEDOUT',
  '57P01', // admin_shutdown
  '57P02', // crash_shutdown
  '57P03', // cannot_connect_now
  '53300', // too_many_connections
]);

const isTransientPoolError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = String((error as { code?: string }).code || '').toUpperCase();
  if (code && TRANSIENT_ERROR_CODES.has(code)) {
    return true;
  }

  const message = String((error as { message?: string }).message || '').toLowerCase();
  return (
    message.includes('connection terminated unexpectedly') ||
    message.includes('connection reset') ||
    message.includes('server closed the connection unexpectedly')
  );
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Returns the shared Cloud SQL pool. Call once at boot to fail fast if env is missing.
 */
export function getPool(): Pool {
  if (pool) return pool;

  const host = getRequiredEnv('CLOUD_SQL_HOST');
  const database = getRequiredEnv('CLOUD_SQL_DATABASE');
  const user = getRequiredEnv('CLOUD_SQL_USER');
  const password = getRequiredEnv('CLOUD_SQL_PASSWORD');
  const port = parseInt(process.env.CLOUD_SQL_PORT || '5432', 10);
  const sslMode = (process.env.CLOUD_SQL_SSLMODE || '').toLowerCase();
  const ssl = sslMode === 'require' || sslMode === 'verify-full' || process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: sslMode === 'verify-full' }
    : false;

  pool = new Pool({
    host,
    port,
    database,
    user,
    password,
    ssl: ssl as boolean | object,
    keepAlive: true,
    idleTimeoutMillis: parseInt(process.env.CLOUD_SQL_IDLE_TIMEOUT_MS || '30000', 10),
    connectionTimeoutMillis: parseInt(
      process.env.CLOUD_SQL_CONNECT_TIMEOUT_MS || '10000',
      10
    ),
    max: parseInt(process.env.CLOUD_SQL_MAX_CLIENTS || '10', 10),
  });

  return pool;
}

export async function queryCloudSql<T = any>(
  text: string,
  params: any[] = [],
  retries = 2
): Promise<{ rows: T[]; rowCount: number | null }> {
  let attempt = 0;
  while (true) {
    try {
      const p = getPool();
      const result = await p.query<T>(text, params);
      return { rows: result.rows, rowCount: result.rowCount };
    } catch (error) {
      if (attempt >= retries || !isTransientPoolError(error)) {
        throw error;
      }

      attempt += 1;
      console.warn(
        `[cloud-sql] transient query failure (attempt ${attempt}/${retries + 1}), retrying...`,
        (error as Error).message
      );

      // Reset the pool so retries use a fresh connection if the current socket is stale.
      if (pool) {
        try {
          await pool.end();
        } catch {
          // Ignore close errors; retry will recreate the pool.
        } finally {
          pool = null;
        }
      }

      await sleep(150 * attempt);
    }
  }
}
