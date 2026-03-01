#!/usr/bin/env npx tsx
/**
 * Check table structure in Cloud SQL (phi_contracts, phi_clients)
 * Usage: npx tsx scripts/check_cloudsql_tables.ts
 */
import 'dotenv/config';
import { getPool } from '../src/db/cloudSqlPool';

async function main() {
  const pool = getPool();

  for (const table of ['phi_contracts', 'phi_clients']) {
    console.log(`\n=== ${table} ===`);
    const { rows } = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `, [table]);
    if (rows.length === 0) {
      console.log('  (table not found)');
    } else {
      rows.forEach((r: any) =>
        console.log(`  ${r.column_name}: ${r.data_type} ${r.is_nullable === 'NO' ? 'NOT NULL' : ''} ${r.column_default ? `DEFAULT ${r.column_default}` : ''}`)
      );
    }
  }

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
