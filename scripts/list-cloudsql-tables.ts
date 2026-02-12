/**
 * List all tables in the Cloud SQL database (sokana_private).
 * Uses CLOUD_SQL_* env vars from .env (same as the backend).
 *
 * Usage: npx tsx scripts/list-cloudsql-tables.ts
 */

import 'dotenv/config';
import { getPool } from '../src/db/cloudSqlPool';

async function main() {
  const pool = getPool();

  const { rows } = await pool.query<{ table_schema: string; table_name: string }>(`
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
    ORDER BY table_schema, table_name
  `);

  console.log('Cloud SQL tables:\n');
  const bySchema = rows.reduce<Record<string, string[]>>((acc, r) => {
    if (!acc[r.table_schema]) acc[r.table_schema] = [];
    acc[r.table_schema].push(r.table_name);
    return acc;
  }, {});
  for (const [schema, tables] of Object.entries(bySchema)) {
    console.log(`  [${schema}]`);
    tables.forEach((t) => console.log(`    - ${t}`));
    console.log('');
  }
  console.log(`Total: ${rows.length} table(s)`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
