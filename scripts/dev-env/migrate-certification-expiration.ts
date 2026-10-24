/** P-16: explicitly dev-only, additive certification migration. No production fallback. */
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
      'SELECT id, certifications FROM public.doulas ORDER BY id'
    );
    await pool.query(
      fs.readFileSync(
        path.join(
          __dirname,
          '../../src/db/migrations/20261024_certification_expiration_date.sql'
        ),
        'utf8'
      )
    );
    const after = await pool.query(
      'SELECT id, certifications FROM public.doulas ORDER BY id'
    );
    for (let i = 0; i < before.rows.length; i++) {
      const old = before.rows[i];
      const current = after.rows[i];
      if (old.id !== current.id) throw new Error('Unexpected profile change.');
      if (!Array.isArray(old.certifications)) continue;
      const expected = old.certifications.map(
        (entry: Record<string, unknown>) => ({
          expiration_date: null,
          no_expiration: false,
          ...entry,
        })
      );
      if (JSON.stringify(expected) !== JSON.stringify(current.certifications)) {
        // PostgreSQL JSONB reorders object keys. Compare canonical objects.
        const canonical = (value: unknown): string =>
          JSON.stringify(value, (_, item) =>
            item && typeof item === 'object' && !Array.isArray(item)
              ? Object.fromEntries(
                  Object.entries(item).sort(([a], [b]) => a.localeCompare(b))
                )
              : item
          );
        if (canonical(expected) !== canonical(current.certifications))
          throw new Error('Certification preservation check failed.');
      }
    }
    console.log(
      `Dev migration verified for ${before.rows.length} fictional/test profiles; historical data preserved.`
    );
  } finally {
    await pool.end();
  }
}
main().catch(() => {
  console.error(
    'Dev certification migration failed. Check dev target configuration and database access.'
  );
  process.exitCode = 1;
});
