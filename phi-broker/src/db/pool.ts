/**
 * Cloud SQL Connection Pool for PHI Broker
 * 
 * HIPAA COMPLIANCE:
 * - Connection credentials are NEVER logged
 * - Pool errors do not expose connection details
 */

import { Pool, PoolConfig } from 'pg';

let pool: Pool | null = null;

/**
 * Get or create the Cloud SQL connection pool.
 */
export function getPool(): Pool {
  if (pool) {
    return pool;
  }

  const host = process.env.SENSITIVE_DATABASE_HOST;
  const port = parseInt(process.env.SENSITIVE_DATABASE_PORT || '5432', 10);
  const database = process.env.SENSITIVE_DATABASE_NAME;
  const user = process.env.SENSITIVE_DATABASE_USER;
  const password = process.env.SENSITIVE_DATABASE_PASSWORD;
  const ssl = process.env.SENSITIVE_DATABASE_SSL === 'true';

  if (!host || !database || !user || !password) {
    throw new Error('[DB] Missing required database configuration');
  }

  const config: PoolConfig = {
    host,
    port,
    database,
    user,
    password,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  };

  if (ssl) {
    config.ssl = {
      rejectUnauthorized: false, // Cloud SQL may use self-signed certs
    };
  }

  pool = new Pool(config);

  // Handle pool errors without logging credentials
  pool.on('error', (err) => {
    console.error('[DB] Unexpected pool error occurred');
    // Do NOT log err object which may contain connection info
  });

  console.log('[DB] Pool initialized', { host: host.substring(0, 10) + '...', port, ssl });

  return pool;
}

/**
 * Close the pool gracefully.
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('[DB] Pool closed');
  }
}

/**
 * Test database connectivity.
 */
export async function testConnection(): Promise<boolean> {
  try {
    const p = getPool();
    const result = await p.query('SELECT 1 as connected');
    return result.rows.length > 0;
  } catch (error) {
    console.error('[DB] Connection test failed');
    return false;
  }
}
