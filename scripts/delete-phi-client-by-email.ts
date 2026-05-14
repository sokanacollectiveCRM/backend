/**
 * Delete phi_clients row(s) by email (Cloud SQL via proxy).
 * Usage: npx ts-node scripts/delete-phi-client-by-email.ts [email]
 * Requires: .env CLOUD_SQL_*, proxy on CLOUD_SQL_HOST:PORT
 */
import 'dotenv/config';
import { Pool } from 'pg';

const email = process.argv[2] || 'test.lead@example.com';

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
    const sel = await pool.query(
      'SELECT id, first_name, last_name, email, status FROM phi_clients WHERE email = $1',
      [email]
    );
    if (sel.rowCount === 0) {
      console.log('No rows found for email:', email);
      return;
    }
    console.log('About to delete:', JSON.stringify(sel.rows, null, 2));
    const del = await pool.query(
      'DELETE FROM phi_clients WHERE email = $1 RETURNING id, first_name, last_name, email',
      [email]
    );
    console.log('Deleted row count:', del.rowCount);
    console.log(JSON.stringify(del.rows, null, 2));
  } catch (err) {
    console.error('Error:', (err as Error).message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
