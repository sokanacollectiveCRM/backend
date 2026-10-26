/** P-22: DEV only. Optionally grant/revoke an existing DEV admin's HR/payroll capability. */
import { parse } from 'dotenv';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

async function main() {
  const [envFile, adminId, department] = process.argv.slice(2);
  if (!envFile)
    throw new Error(
      'Pass isolated dev.env path and optional admin UUID plus hr/payroll/revoke.'
    );
  if (
    adminId &&
    (!/^[0-9a-f-]{36}$/i.test(adminId) ||
      !['hr', 'payroll', 'revoke'].includes(department))
  )
    throw new Error(
      'Expected existing DEV admin UUID and hr, payroll, or revoke.'
    );
  const env = parse(fs.readFileSync(envFile));
  if (
    env.DEV_INSTANCE !== 'sokana-phi-postgres-dev' ||
    env.CLOUD_SQL_DATABASE !== 'sokana_private_dev' ||
    env.CLOUD_SQL_HOST !== '127.0.0.1' ||
    env.CLOUD_SQL_PORT !== '5434' ||
    env.DB_INSTANCE_CONNECTION_NAME !==
      'sokana-private-data:us-central1:sokana-phi-postgres-dev' ||
    !env.DEV_POSTGRES_PASSWORD
  )
    throw new Error('Refusing non-DEV migration.');
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
    if (
      (await pool.query('SELECT current_database() AS name')).rows[0].name !==
      'sokana_private_dev'
    )
      throw new Error('Unexpected database.');
    const before = (
      await pool.query(
        'SELECT id, file_path, document_type FROM public.doula_documents ORDER BY id'
      )
    ).rows;
    await pool.query(
      fs.readFileSync(
        path.join(
          __dirname,
          '../../src/db/migrations/20261025_p22_documents_background_check.sql'
        ),
        'utf8'
      )
    );
    const after = (
      await pool.query(
        'SELECT id, file_path, document_type FROM public.doula_documents ORDER BY id'
      )
    ).rows;
    if (JSON.stringify(before) !== JSON.stringify(after))
      throw new Error('Historical document preservation failed.');
    if (adminId) {
      if (department === 'revoke')
        await pool.query(
          'DELETE FROM public.doula_hr_permissions WHERE admin_id=$1',
          [adminId]
        );
      else {
        const result = await pool.query(
          `INSERT INTO public.doula_hr_permissions(tenant_id,admin_id,department)
          SELECT tenant_id,id::text,$2 FROM public.admins WHERE id=$1::uuid
          ON CONFLICT(tenant_id,admin_id) DO UPDATE SET department=EXCLUDED.department RETURNING admin_id`,
          [adminId, department]
        );
        if (!result.rowCount) throw new Error('DEV admin not found.');
      }
      console.log('DEV HR/payroll capability updated.');
    }
    console.log(
      `P-22 DEV migration verified; ${before.length} historical documents preserved.`
    );
  } finally {
    await pool.end();
  }
}
main().catch(() => {
  console.error(
    'P-22 DEV migration/permission update failed. Check target configuration and database access.'
  );
  process.exitCode = 1;
});
