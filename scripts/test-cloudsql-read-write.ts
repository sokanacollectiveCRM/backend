/**
 * Test Cloud SQL read and write using a dedicated test table (no real data).
 * Uses CLOUD_SQL_* env vars (same as the app / test user).
 *
 * Creates the test table if missing, then INSERT / SELECT / DELETE one row (no real data).
 *
 * Usage: npx tsx scripts/test-cloudsql-read-write.ts
 * Or with env: CLOUD_SQL_HOST=127.0.0.1 CLOUD_SQL_PORT=5433 ... npx tsx scripts/test-cloudsql-read-write.ts
 */

import 'dotenv/config';
import { getPool } from '../src/db/cloudSqlPool';

const TEST_TABLE = 'cloudsql_connectivity_test';
const TEST_VALUE = 'connectivity-test-' + Date.now();

async function main() {
  console.log('Cloud SQL read/write test (test table only, no real data)\n');

  const pool = getPool();

  // Ensure test table exists (no-op if already there)
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.cloudsql_connectivity_test (
        id         SERIAL PRIMARY KEY,
        value      TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  } catch (e) {
    console.log('  Setup (CREATE TABLE): error', (e as Error).message);
    await pool.end();
    process.exit(1);
  }

  let writeOk = false;
  let readOk = false;
  let insertId: number | null = null;

  try {
    // Write: INSERT one row
    const insert = await pool.query<{ id: number }>(
      `INSERT INTO ${TEST_TABLE} (value) VALUES ($1) RETURNING id`,
      [TEST_VALUE]
    );
    insertId = insert.rows[0]?.id ?? null;
    if (insertId != null) {
      writeOk = true;
      console.log('  Write (INSERT): ok, id =', insertId);
    } else {
      console.log('  Write (INSERT): failed (no id returned)');
    }
  } catch (e) {
    const err = e as Error;
    console.log('  Write (INSERT): error', err.message);
  }

  if (insertId != null) {
    try {
      // Read: SELECT the row back
      const sel = await pool.query(
        `SELECT id, value, created_at FROM ${TEST_TABLE} WHERE id = $1`,
        [insertId]
      );
      if (sel.rows.length === 1 && sel.rows[0].value === TEST_VALUE) {
        readOk = true;
        console.log('  Read (SELECT): ok');
      } else {
        console.log('  Read (SELECT): unexpected row or value');
      }
    } catch (e) {
      console.log('  Read (SELECT): error', (e as Error).message);
    }

    try {
      // Cleanup: DELETE the test row
      await pool.query(`DELETE FROM ${TEST_TABLE} WHERE id = $1`, [insertId]);
      console.log('  Cleanup (DELETE): ok');
    } catch (e) {
      console.log('  Cleanup (DELETE): error', (e as Error).message);
    }
  }

  // Also test a read-only query that does not touch real data (table list)
  let listReadOk = false;
  try {
    const { rows } = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
      [TEST_TABLE]
    );
    listReadOk = true;
    console.log('  Read (info_schema): ok');
  } catch (e) {
    console.log('  Read (info_schema): error', (e as Error).message);
  }

  await pool.end();

  console.log('');
  if (writeOk && readOk) {
    console.log('Result: PASS — Cloud SQL read and write work (test table only).');
    process.exit(0);
  }
  if (listReadOk && !writeOk) {
    console.log('Result: READ only — Cloud SQL connection works; test table may be missing (run migration).');
    process.exit(0);
  }
  console.log('Result: FAIL — Check CLOUD_SQL_* env and that the test table exists.');
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
