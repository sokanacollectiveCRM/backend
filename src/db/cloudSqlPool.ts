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
  });

  return pool;
}
