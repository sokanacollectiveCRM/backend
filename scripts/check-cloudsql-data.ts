/**
 * Quick script to verify Cloud SQL connection and phi_clients data.
 * Run: npx ts-node scripts/check-cloudsql-data.ts
 * Requires: .env with CLOUD_SQL_* vars, Cloud SQL Proxy on 127.0.0.1:5433
 */
import 'dotenv/config';
import { Pool } from 'pg';

async function main() {
  const host = process.env.CLOUD_SQL_HOST || '127.0.0.1';
  const port = parseInt(process.env.CLOUD_SQL_PORT || '5433', 10);
  const database = process.env.CLOUD_SQL_DATABASE || 'sokana_private';
  const user = process.env.CLOUD_SQL_USER || 'app_user';
  const password = process.env.CLOUD_SQL_PASSWORD;

  if (!password) {
    console.error('CLOUD_SQL_PASSWORD not set in .env');
    process.exit(1);
  }

  const pool = new Pool({
    host,
    port,
    database,
    user,
    password,
    ssl: false,
  });

  try {
    const { rows: countRows } = await pool.query('SELECT COUNT(*)::int AS n FROM phi_clients');
    const count = countRows[0]?.n ?? 0;
    console.log('phi_clients count:', count);

    if (count > 0) {
      const { rows } = await pool.query(
        'SELECT id, first_name, last_name, email, status FROM phi_clients ORDER BY updated_at DESC NULLS LAST LIMIT 5'
      );
      console.log('Sample rows:', JSON.stringify(rows, null, 2));
    }
  } catch (err) {
    console.error('Error:', (err as Error).message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
