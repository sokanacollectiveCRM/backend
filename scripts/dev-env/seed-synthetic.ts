#!/usr/bin/env npx tsx
import fs from 'fs';
import path from 'path';
import { Pool, PoolClient } from 'pg';

import {
  type ColumnMeta,
  SYNTHETIC_EMAIL_DOMAIN,
  SYNTHETIC_MARKER,
  buildFixtureCatalog,
  clientNumberForIndex,
  isProductionTarget,
  prepareInsert,
  syntheticEmail,
  syntheticId,
} from './syntheticSeed';

type Args = {
  envFile: string;
  reset: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    envFile: path.join(__dirname, '.local', 'dev.env'),
    reset: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--reset') {
      args.reset = true;
    } else if (token === '--env-file') {
      args.envFile = argv[i + 1];
      i += 1;
    } else if (token === '--help' || token === '-h') {
      console.log(
        'Usage: npx tsx scripts/dev-env/seed-synthetic.ts [--env-file path] [--reset]'
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }
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
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    process.env[key] = value;
  }
}

async function tableColumns(
  client: PoolClient,
  table: string
): Promise<ColumnMeta[] | null> {
  const { rows } = await client.query<ColumnMeta>(
    `
    SELECT column_name, is_nullable, column_default, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    ORDER BY ordinal_position
    `,
    [table]
  );
  return rows.length > 0 ? rows : null;
}

async function tableExists(
  client: PoolClient,
  table: string
): Promise<boolean> {
  const { rows } = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS exists`,
    [table]
  );
  return Boolean(rows[0]?.exists);
}

async function upsert(
  client: PoolClient,
  columns: ColumnMeta[] | null,
  table: string,
  row: Record<string, unknown>,
  conflictColumns: string[] = ['id']
): Promise<string | null> {
  if (!columns) {
    console.log(`  skip ${table} (table missing)`);
    return null;
  }
  const insert = prepareInsert(
    `public.${table}`,
    columns,
    row,
    conflictColumns
  );
  await client.query('SAVEPOINT seed_row');
  try {
    await client.query(insert.sql, insert.values);
    await client.query('RELEASE SAVEPOINT seed_row');
    return String(row.id ?? '');
  } catch (error) {
    await client.query('ROLLBACK TO SAVEPOINT seed_row');
    const message = error instanceof Error ? error.message : String(error);
    if (/no unique or exclusion constraint/i.test(message)) {
      const quoted = insert.columns.map((column) => `"${column}"`).join(', ');
      const params = insert.columns
        .map((_, index) => `$${index + 1}`)
        .join(', ');
      await client.query('SAVEPOINT seed_row');
      try {
        await client.query(
          `INSERT INTO public.${table} (${quoted}) VALUES (${params})`,
          insert.values
        );
        await client.query('RELEASE SAVEPOINT seed_row');
        return String(row.id ?? '');
      } catch (retryError) {
        await client.query('ROLLBACK TO SAVEPOINT seed_row');
        const retryMessage =
          retryError instanceof Error ? retryError.message : String(retryError);
        console.warn(`  skip ${table}: ${retryMessage}`);
        return null;
      }
    }
    console.warn(`  skip ${table}: ${message}`);
    return null;
  }
}

async function resetSynthetic(client: PoolClient): Promise<void> {
  const like = `%@${SYNTHETIC_EMAIL_DOMAIN}`;
  if (await tableExists(client, 'hours')) {
    await client.query(
      `DELETE FROM public.hours
       WHERE client_id IN (
         SELECT id FROM public.phi_clients WHERE email LIKE $1
       )
       OR doula_id IN (SELECT id FROM public.doulas WHERE email LIKE $1)`,
      [like]
    );
  }
  if (await tableExists(client, 'client_activities')) {
    await client.query(
      `DELETE FROM public.client_activities
       WHERE client_id IN (
         SELECT id FROM public.phi_clients WHERE email LIKE $1
       )`,
      [like]
    );
  }
  if (await tableExists(client, 'doula_assignments')) {
    await client.query(
      `DELETE FROM public.doula_assignments
       WHERE client_id IN (
         SELECT id FROM public.phi_clients WHERE email LIKE $1
       )
       OR doula_id IN (SELECT id FROM public.doulas WHERE email LIKE $1)`,
      [like]
    );
  }
  if (await tableExists(client, 'phi_notes')) {
    await client.query(
      `DELETE FROM public.phi_notes
       WHERE client_id IN (
         SELECT id FROM public.phi_clients WHERE email LIKE $1
       )`,
      [like]
    );
  }
  if (await tableExists(client, 'phi_contracts')) {
    await client.query(
      `DELETE FROM public.phi_contracts
       WHERE client_id IN (
         SELECT id FROM public.phi_clients WHERE email LIKE $1
       )`,
      [like]
    );
  }
  if (await tableExists(client, 'phi_clients')) {
    await client.query(`DELETE FROM public.phi_clients WHERE email LIKE $1`, [
      like,
    ]);
  }
  if (await tableExists(client, 'doulas')) {
    await client.query(`DELETE FROM public.doulas WHERE email LIKE $1`, [like]);
  }
  if (await tableExists(client, 'admins')) {
    await client.query(`DELETE FROM public.admins WHERE email LIKE $1`, [like]);
  }
}

async function seed(client: PoolClient, args: Args): Promise<void> {
  const fixture = buildFixtureCatalog();
  const now = new Date();
  const dueOffset = (days: number) => {
    const date = new Date(now);
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  };

  if (args.reset) {
    console.log('Resetting previous synthetic rows...');
    await resetSynthetic(client);
  }

  const adminColumns = await tableColumns(client, 'admins');
  const doulaColumns = await tableColumns(client, 'doulas');
  const clientColumns = await tableColumns(client, 'phi_clients');
  const assignmentColumns = await tableColumns(client, 'doula_assignments');
  const hoursColumns = await tableColumns(client, 'hours');
  const activityColumns = await tableColumns(client, 'client_activities');
  const contractColumns = await tableColumns(client, 'phi_contracts');
  const notesColumns = await tableColumns(client, 'phi_notes');

  const adminId =
    process.env.DEV_ENV_ADMIN_UID || syntheticId(fixture.admin.key);
  console.log('Seeding admin...');
  await upsert(client, adminColumns, 'admins', {
    id: adminId,
    full_name: `${fixture.admin.firstName} ${fixture.admin.lastName}`,
    first_name: fixture.admin.firstName,
    last_name: fixture.admin.lastName,
    email: syntheticEmail(fixture.admin.emailLocal),
    phone: fixture.admin.phone,
    identity_platform_uid: process.env.DEV_ENV_ADMIN_UID || null,
    created_at: now,
    updated_at: now,
  });

  const doulaIds = new Map<string, string>();
  for (const [index, doula] of fixture.doulas.entries()) {
    const envKey = index === 0 ? process.env.DEV_ENV_DOULA_UID : undefined;
    const id = envKey || syntheticId(doula.key);
    doulaIds.set(doula.key, id);
    console.log(`Seeding doula ${doula.firstName} ${doula.lastName}...`);
    await upsert(client, doulaColumns, 'doulas', {
      id,
      full_name: `${doula.firstName} ${doula.lastName}`,
      email: syntheticEmail(doula.emailLocal),
      phone: doula.phone,
      account_status: 'approved',
      bio: doula.bio,
      city: doula.city,
      state: 'IL',
      country: 'USA',
      zip_code: '60601',
      identity_platform_uid: envKey || null,
      created_at: now,
      updated_at: now,
    });
  }

  for (const [index, person] of fixture.clients.entries()) {
    const id = syntheticId(person.key);
    const email = syntheticEmail(person.emailLocal);
    console.log(`Seeding client ${person.firstName} ${person.lastName}...`);
    await upsert(client, clientColumns, 'phi_clients', {
      id,
      client_id: id,
      client_number: clientNumberForIndex(index),
      first_name: person.firstName,
      last_name: person.lastName,
      email,
      phone: person.phone,
      address_line1: `${100 + index} Synthetic Ave`,
      city: person.city,
      state: person.state,
      zip_code: person.zip,
      country: 'USA',
      date_of_birth: '1992-04-15',
      due_date: person.dueDate || dueOffset(90),
      status: person.status,
      portal_status: person.portalStatus,
      payment_method: person.paymentMethod,
      service_needed: person.serviceNeeded,
      insurance_provider:
        person.paymentMethod === 'Medicaid'
          ? 'Illinois Medicaid'
          : person.paymentMethod === 'Commercial Insurance'
            ? 'Blue Cross Synthetic'
            : null,
      health_history: 'Synthetic record. Not a real patient.',
      health_notes: SYNTHETIC_MARKER,
      requested_at: now,
      created_at: now,
      updated_at: now,
    });

    if (person.assignedDoulaKey) {
      const doulaId = doulaIds.get(person.assignedDoulaKey);
      if (doulaId) {
        await upsert(
          client,
          assignmentColumns,
          'doula_assignments',
          {
            client_id: id,
            doula_id: doulaId,
            role: person.assignmentRole || 'primary',
            services: person.services,
            status: 'active',
            notes: SYNTHETIC_MARKER,
            assigned_at: now,
            created_at: now,
            updated_at: now,
          },
          ['client_id', 'doula_id']
        );
      }
    }

    if (person.hourType && person.assignedDoulaKey) {
      const doulaId = doulaIds.get(person.assignedDoulaKey);
      if (doulaId) {
        const start = new Date(now);
        start.setDate(start.getDate() - 7);
        const end = new Date(start);
        end.setHours(end.getHours() + 2);
        await upsert(client, hoursColumns, 'hours', {
          id: syntheticId(`hours:${person.key}`),
          doula_id: doulaId,
          client_id: id,
          start_time: start,
          end_time: end,
          type: person.hourType,
          created_at: now,
          updated_at: now,
        });
      }
    }

    await upsert(client, activityColumns, 'client_activities', {
      id: syntheticId(`activity:${person.key}`),
      client_id: id,
      type: 'note',
      description: `Synthetic ${person.status} visit note for ${person.firstName}.`,
      metadata: {
        createdByName: 'Dev Admin',
        createdByRole: 'admin',
        marker: SYNTHETIC_MARKER,
      },
      timestamp: now,
    });

    await upsert(client, notesColumns, 'phi_notes', {
      id: syntheticId(`note:${person.key}`),
      client_id: id,
      note_date: now,
      title: 'Synthetic prenatal note',
      note_content: `Fixture note (${SYNTHETIC_MARKER}).`,
      created_at: now,
    });

    if (person.status === 'active') {
      await upsert(client, contractColumns, 'phi_contracts', {
        id: syntheticId(`contract:${person.key}`),
        client_id: id,
        status: 'signed',
        created_at: now,
        updated_at: now,
      });
    }
  }
}

async function printSummary(client: PoolClient): Promise<void> {
  const like = `%@${SYNTHETIC_EMAIL_DOMAIN}`;
  const queries: Array<[string, string]> = [
    [
      'admins',
      `SELECT COUNT(*)::int AS n FROM public.admins WHERE email LIKE $1`,
    ],
    [
      'doulas',
      `SELECT COUNT(*)::int AS n FROM public.doulas WHERE email LIKE $1`,
    ],
    [
      'phi_clients',
      `SELECT COUNT(*)::int AS n FROM public.phi_clients WHERE email LIKE $1`,
    ],
    [
      'doula_assignments',
      `SELECT COUNT(*)::int AS n FROM public.doula_assignments
       WHERE client_id IN (SELECT id FROM public.phi_clients WHERE email LIKE $1)`,
    ],
    [
      'hours',
      `SELECT COUNT(*)::int AS n FROM public.hours
       WHERE client_id IN (SELECT id FROM public.phi_clients WHERE email LIKE $1)`,
    ],
    [
      'client_activities',
      `SELECT COUNT(*)::int AS n FROM public.client_activities
       WHERE client_id IN (SELECT id FROM public.phi_clients WHERE email LIKE $1)`,
    ],
    [
      'phi_contracts',
      `SELECT COUNT(*)::int AS n FROM public.phi_contracts
       WHERE client_id IN (SELECT id FROM public.phi_clients WHERE email LIKE $1)`,
    ],
  ];
  console.log('\nSynthetic row counts:');
  for (const [label, sql] of queries) {
    if (!(await tableExists(client, label))) continue;
    const { rows } = await client.query<{ n: number }>(sql, [like]);
    console.log(`  ${label}: ${rows[0]?.n ?? 0}`);
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
    throw new Error(targetError);
  }

  const host = process.env.CLOUD_SQL_HOST;
  const database = process.env.CLOUD_SQL_DATABASE;
  const user = process.env.CLOUD_SQL_USER;
  const password = process.env.CLOUD_SQL_PASSWORD;
  const port = parseInt(process.env.CLOUD_SQL_PORT || '5434', 10);
  if (!host || !database || !user || !password) {
    throw new Error(
      'CLOUD_SQL_HOST, CLOUD_SQL_DATABASE, CLOUD_SQL_USER, CLOUD_SQL_PASSWORD are required in the env file'
    );
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
    await client.query('BEGIN');
    await seed(client, args);
    await client.query('COMMIT');
    await printSummary(client);
    console.log('\nSynthetic emails use domain @' + SYNTHETIC_EMAIL_DOMAIN);
    console.log(
      'Optional: set DEV_ENV_ADMIN_UID / DEV_ENV_DOULA_UID to link Identity Platform logins.'
    );
  } catch (error) {
    await client.query('ROLLBACK');
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
