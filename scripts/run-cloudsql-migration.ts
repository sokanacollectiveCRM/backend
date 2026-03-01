#!/usr/bin/env npx tsx
/**
 * Run a Cloud SQL migration using credentials from .env.
 * Usage: npx tsx scripts/run-cloudsql-migration.ts [migration-file.sql]
 *        npm run migrate:cloudsql -- src/db/migrations/create_payment_schedules_cloudsql.sql
 *
 * Reads CLOUD_SQL_HOST, CLOUD_SQL_PORT, CLOUD_SQL_DATABASE, CLOUD_SQL_USER, CLOUD_SQL_PASSWORD from .env.
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

const host = process.env.CLOUD_SQL_HOST;
const port = parseInt(process.env.CLOUD_SQL_PORT || '5432', 10);
const database = process.env.CLOUD_SQL_DATABASE;
const user = process.env.CLOUD_SQL_USER;
const password = process.env.CLOUD_SQL_PASSWORD;

if (!host || !database || !user || !password) {
  console.error('❌ Missing Cloud SQL env vars. Ensure .env has:');
  console.error('   CLOUD_SQL_HOST, CLOUD_SQL_DATABASE, CLOUD_SQL_USER, CLOUD_SQL_PASSWORD');
  process.exit(1);
}

const migrationPath = process.argv[2] || 'src/db/migrations/create_payment_schedules_cloudsql.sql';
const fullPath = path.resolve(process.cwd(), migrationPath);

if (!fs.existsSync(fullPath)) {
  console.error(`❌ Migration file not found: ${fullPath}`);
  process.exit(1);
}

const sql = fs.readFileSync(fullPath, 'utf8');

async function run() {
  const pool = new Pool({
    host,
    port,
    database,
    user,
    password,
    ssl: (process.env.CLOUD_SQL_SSLMODE || 'disable').toLowerCase() === 'require' ? { rejectUnauthorized: false } : false,
  });

  try {
    console.log(`🔄 Running migration: ${migrationPath}`);
    await pool.query(sql);
    console.log('✅ Migration completed successfully');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
