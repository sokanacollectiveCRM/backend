#!/usr/bin/env npx tsx
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

import {
  DEFAULT_ISOLATED_ADMIN_EMAIL,
  DEFAULT_PILOT_CLIENT_EMAIL,
  resolveIsolatedAdminEmail,
} from './adminLogin';
import { isProductionTarget } from './syntheticSeed';
import { buildTruncateSql, quoteIdent } from './wipeData';

type Args = {
  envFile: string;
  email: string;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    envFile: path.join(__dirname, '.local', 'dev.env'),
    email: process.env.DEV_ENV_ADMIN_EMAIL || DEFAULT_ISOLATED_ADMIN_EMAIL,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--env-file') {
      args.envFile = argv[i + 1];
      i += 1;
    } else if (token === '--email') {
      args.email = argv[i + 1];
      i += 1;
    } else if (token === '--help' || token === '-h') {
      console.log(
        'Usage: npx tsx scripts/dev-env/wipe-data.ts [--email addr] [--env-file path]'
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }
  args.email = resolveIsolatedAdminEmail(args.email);
  return args;
}

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Missing ${filePath}. Run bash scripts/dev-env/create-instance.sh first.`
    );
  }
  const text = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    process.env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  loadEnvFile(args.envFile);

  const targetError = isProductionTarget({
    database: process.env.CLOUD_SQL_DATABASE,
    host: process.env.CLOUD_SQL_HOST,
    instance: process.env.DB_INSTANCE_CONNECTION_NAME,
  });
  if (targetError) {
    throw new Error(targetError.replace('seed', 'wipe'));
  }

  const host = process.env.CLOUD_SQL_HOST;
  const database = process.env.CLOUD_SQL_DATABASE;
  const user = process.env.CLOUD_SQL_USER;
  const password = process.env.CLOUD_SQL_PASSWORD;
  const port = parseInt(process.env.CLOUD_SQL_PORT || '5434', 10);
  if (!host || !database || !user || !password) {
    throw new Error('CLOUD_SQL_* values are required in the isolated env file');
  }
  if (database !== 'sokana_private_dev') {
    throw new Error(`Refusing to wipe unexpected database ${database}`);
  }

  const pool = new Pool({
    host,
    port,
    database,
    user,
    password,
    ssl: false,
  });
  const client = await pool.connect();
  try {
    const { rows: tableRows } = await client.query<{ table_name: string }>(
      `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
      `
    );
    const tables = tableRows.map((row) => row.table_name);
    if (!tables.includes('admins')) {
      throw new Error('public.admins is missing on the isolated database');
    }

    await client.query('BEGIN');
    await client.query(
      `
      CREATE TEMP TABLE keep_admin AS
      SELECT * FROM public.admins WHERE lower(email) = $1
      `,
      [args.email]
    );
    const kept = await client.query<{ n: number }>(
      'SELECT COUNT(*)::int AS n FROM keep_admin'
    );
    if ((kept.rows[0]?.n ?? 0) !== 1) {
      throw new Error(
        `Expected exactly one admin with email ${args.email}; found ${kept.rows[0]?.n ?? 0}`
      );
    }

    const keepClientEmail = resolveIsolatedAdminEmail(
      process.env.DEV_ENV_CLIENT_EMAIL || DEFAULT_PILOT_CLIENT_EMAIL
    );
    if (tables.includes('phi_clients')) {
      await client.query(
        `
        CREATE TEMP TABLE keep_client AS
        SELECT * FROM public.phi_clients WHERE lower(email) = $1
        `,
        [keepClientEmail]
      );
    }

    await client.query(buildTruncateSql(tables));
    await client.query('INSERT INTO public.admins SELECT * FROM keep_admin');
    if (tables.includes('phi_clients')) {
      const keptClients = await client.query<{ n: number }>(
        'SELECT COUNT(*)::int AS n FROM keep_client'
      );
      if ((keptClients.rows[0]?.n ?? 0) > 0) {
        await client.query(
          'INSERT INTO public.phi_clients SELECT * FROM keep_client'
        );
      }
    }
    await client.query('COMMIT');

    const summaryTables = [
      'admins',
      'doulas',
      'phi_clients',
      'doula_assignments',
      'hours',
      'client_activities',
      'phi_contracts',
      'phi_notes',
    ].filter((name) => tables.includes(name));
    console.log(
      `Wiped ${database}; kept admin ${args.email} and pilot client ${keepClientEmail}`
    );
    for (const table of summaryTables) {
      const { rows } = await client.query<{ n: number }>(
        `SELECT COUNT(*)::int AS n FROM public.${quoteIdent(table)}`
      );
      console.log(`  ${table}: ${rows[0]?.n ?? 0}`);
    }
    const leftovers: string[] = [];
    for (const table of tables) {
      if (table === 'admins') continue;
      const { rows } = await client.query<{ n: number }>(
        `SELECT COUNT(*)::int AS n FROM public.${quoteIdent(table)}`
      );
      if ((rows[0]?.n ?? 0) > 0) {
        leftovers.push(`${table}:${rows[0].n}`);
      }
    }
    if (leftovers.length > 0) {
      console.log(`  leftover rows: ${leftovers.join(', ')}`);
    }
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback failures
    }
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
