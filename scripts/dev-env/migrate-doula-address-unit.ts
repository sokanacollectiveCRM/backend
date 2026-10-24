/** P-19: explicitly dev-only address migration. No production fallback. */
import { parse } from 'dotenv';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

async function main() {
  const envFile = process.argv[2];
  if (!envFile) throw new Error('Pass the isolated dev.env file path.');
  const env = parse(fs.readFileSync(envFile));
  if (
    env.DEV_INSTANCE !== 'sokana-phi-postgres-dev' ||
    env.CLOUD_SQL_DATABASE !== 'sokana_private_dev' ||
    env.CLOUD_SQL_HOST !== '127.0.0.1' ||
    env.CLOUD_SQL_PORT !== '5434' ||
    env.DB_INSTANCE_CONNECTION_NAME !==
      'sokana-private-data:us-central1:sokana-phi-postgres-dev'
  ) {
    throw new Error(
      'Refusing migration: expected the isolated dev database through the dev proxy.'
    );
  }
  if (!env.DEV_POSTGRES_PASSWORD)
    throw new Error('Dev PostgreSQL credential is missing.');
  const pool = new Pool({
    host: '127.0.0.1',
    port: 5434,
    database: 'sokana_private_dev',
    user: 'postgres',
    password: env.DEV_POSTGRES_PASSWORD,
    ssl: false,
    connectionTimeoutMillis: 10000,
    query_timeout: 20000,
  });
  try {
    const database = await pool.query('SELECT current_database() AS name');
    if (database.rows[0].name !== 'sokana_private_dev')
      throw new Error('Unexpected database.');
    const before = await pool.query(
      "SELECT to_jsonb(d) - 'unit_number' AS original FROM public.doulas d ORDER BY id"
    );
    await pool.query(
      fs.readFileSync(
        path.join(
          __dirname,
          '../../src/db/migrations/20261024_doula_address_unit.sql'
        ),
        'utf8'
      )
    );
    const after = await pool.query(
      "SELECT to_jsonb(d) - 'unit_number' AS original FROM public.doulas d ORDER BY id"
    );
    if (JSON.stringify(before.rows) !== JSON.stringify(after.rows))
      throw new Error('Existing row preservation check failed.');
    const schema = await pool.query(
      "SELECT column_default, is_nullable, character_maximum_length FROM information_schema.columns WHERE table_schema='public' AND table_name='doulas' AND column_name='unit_number'"
    );
    if (
      schema.rows[0]?.is_nullable !== 'YES' ||
      schema.rows[0]?.character_maximum_length !== 100
    )
      throw new Error('Unexpected unit schema.');
    const country = await pool.query(
      "SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='doulas' AND column_name='country'"
    );
    if (!country.rows[0]?.column_default?.includes('United States'))
      throw new Error('Country default missing.');
    console.log(
      `DEV address migration verified; ${before.rows.length} existing rows unchanged.`
    );
  } finally {
    await pool.end();
  }
}
main().catch(() => {
  console.error(
    'Dev address migration failed. Check dev target configuration and database access.'
  );
  process.exitCode = 1;
});
