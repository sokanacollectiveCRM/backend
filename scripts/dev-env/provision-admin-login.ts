#!/usr/bin/env npx tsx
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

import admin from 'firebase-admin';

import {
  DEFAULT_ISOLATED_ADMIN_EMAIL,
  DEFAULT_ISOLATED_ADMIN_NAME,
  DEFAULT_PILOT_CLIENT_EMAIL,
  DEFAULT_PILOT_CLIENT_FIRST_NAME,
  DEFAULT_PILOT_CLIENT_LAST_NAME,
  LEGACY_ISOLATED_ADMIN_EMAIL,
  isolatedAdminRow,
  isolatedPilotClientRow,
  resolveIsolatedAdminEmail,
} from './adminLogin';
import {
  type ColumnMeta,
  isProductionTarget,
  prepareInsert,
  syntheticId,
} from './syntheticSeed';

type Args = {
  envFile: string;
  email: string;
  resetPassword: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    envFile: path.join(__dirname, '.local', 'dev.env'),
    email: process.env.DEV_ENV_ADMIN_EMAIL || DEFAULT_ISOLATED_ADMIN_EMAIL,
    resetPassword: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--env-file') {
      args.envFile = argv[i + 1];
      i += 1;
    } else if (token === '--email') {
      args.email = argv[i + 1];
      i += 1;
    } else if (token === '--reset-password') {
      args.resetPassword = true;
    } else if (token === '--help' || token === '-h') {
      console.log(
        'Usage: npx tsx scripts/dev-env/provision-admin-login.ts [--email addr] [--reset-password] [--env-file path]'
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

function writeEnvKv(filePath: string, key: string, value: string): void {
  const escaped = value.replace(/\n/g, '');
  let text = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  const line = `${key}=${escaped}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  if (pattern.test(text)) {
    text = text.replace(pattern, line);
  } else {
    text = `${text.trimEnd()}\n${line}\n`;
  }
  fs.writeFileSync(filePath, text, { mode: 0o600 });
}

function deleteEnvKv(filePath: string, key: string): void {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, 'utf8');
  const next = text
    .split('\n')
    .filter((line) => line.trim() && !line.startsWith(`${key}=`))
    .join('\n');
  fs.writeFileSync(filePath, `${next.trimEnd()}\n`, { mode: 0o600 });
}

function hasPasswordProvider(user: admin.auth.UserRecord): boolean {
  return user.providerData.some((provider) => provider.providerId === 'password');
}

function randomPassword(): string {
  return crypto.randomBytes(18).toString('base64url');
}

async function ensureIdentityUser(
  email: string,
  options: { resetPassword: boolean; displayName?: string }
): Promise<{
  uid: string;
  created: boolean;
  passwordSet: boolean;
  password?: string;
}> {
  const projectId =
    process.env.IDENTITY_PLATFORM_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    'sokana-private-data';
  process.env.GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || projectId;
  process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || projectId;
  process.env.GOOGLE_CLOUD_QUOTA_PROJECT =
    process.env.GOOGLE_CLOUD_QUOTA_PROJECT || projectId;
  if (!admin.apps.length) {
    admin.initializeApp({ projectId });
  }
  const auth = admin.auth();
  try {
    const existing = await auth.getUserByEmail(email);
    if (existing.disabled) {
      await auth.updateUser(existing.uid, { disabled: false });
    }
    if (!existing.emailVerified) {
      await auth.updateUser(existing.uid, { emailVerified: true });
    }
    const needsPassword = options.resetPassword || !hasPasswordProvider(existing);
    if (needsPassword) {
      const password = randomPassword();
      await auth.updateUser(existing.uid, { password });
      return {
        uid: existing.uid,
        created: false,
        passwordSet: true,
        password,
      };
    }
    return { uid: existing.uid, created: false, passwordSet: false };
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== 'auth/user-not-found') {
      throw error;
    }
  }
  const password = randomPassword();
  const created = await auth.createUser({
    email,
    password,
    emailVerified: true,
    displayName: options.displayName,
    disabled: false,
  });
  return { uid: created.uid, created: true, passwordSet: true, password };
}

async function upsertAdmin(
  pool: Pool,
  email: string,
  uid: string
): Promise<void> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query<ColumnMeta>(
      `
      SELECT column_name, is_nullable, column_default, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'admins'
      ORDER BY ordinal_position
      `
    );
    if (rows.length === 0) {
      throw new Error('public.admins is missing on the isolated database');
    }
    const profile = isolatedAdminRow({ email, uid });
    const desired: Record<string, unknown> = {
      id: crypto.randomUUID(),
      ...profile,
      created_at: new Date(),
      updated_at: new Date(),
    };
    const existing = await client.query<{ id: string }>(
      `SELECT id::text AS id FROM public.admins WHERE lower(email) = $1 LIMIT 1`,
      [email]
    );
    if (existing.rows[0]?.id) {
      desired.id = existing.rows[0].id;
    }
    const insert = prepareInsert('public.admins', rows, desired, ['id']);
    await client.query(insert.sql, insert.values);
  } finally {
    client.release();
  }
}

async function upsertPilotClient(
  pool: Pool,
  email: string,
  uid: string
): Promise<void> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query<ColumnMeta>(
      `
      SELECT column_name, is_nullable, column_default, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'phi_clients'
      ORDER BY ordinal_position
      `
    );
    if (rows.length === 0) {
      throw new Error('public.phi_clients is missing on the isolated database');
    }
    const profile = isolatedPilotClientRow({ email, uid });
    const id = syntheticId('pilot:maya-tester');
    const due = new Date();
    due.setDate(due.getDate() + 90);
    const desired: Record<string, unknown> = {
      id,
      client_id: id,
      client_number: 'PILOT-MAYA',
      ...profile,
      preferred_name: DEFAULT_PILOT_CLIENT_FIRST_NAME,
      city: 'Springfield',
      state: 'IL',
      zip_code: '62701',
      country: 'USA',
      due_date: due.toISOString().slice(0, 10),
      requested_at: new Date(),
      invited_at: new Date(),
      health_history: 'Pilot practice client. Not a real patient.',
      created_at: new Date(),
      updated_at: new Date(),
    };
    const existing = await client.query<{ id: string; client_number: string | null }>(
      `SELECT id::text AS id, client_number
       FROM public.phi_clients WHERE lower(email) = $1 LIMIT 1`,
      [email]
    );
    if (existing.rows[0]?.id) {
      desired.id = existing.rows[0].id;
      desired.client_id = existing.rows[0].id;
      if (existing.rows[0].client_number) {
        desired.client_number = existing.rows[0].client_number;
      }
    }
    const insert = prepareInsert('public.phi_clients', rows, desired, ['id']);
    await client.query(insert.sql, insert.values);
  } finally {
    client.release();
  }
}

async function retireLegacyIsolatedAdmin(
  pool: Pool,
  currentAdminEmail: string
): Promise<boolean> {
  const legacy = LEGACY_ISOLATED_ADMIN_EMAIL.toLowerCase();
  if (currentAdminEmail.toLowerCase() === legacy) return false;
  const result = await pool.query(
    `DELETE FROM public.admins WHERE lower(email) = $1`,
    [legacy]
  );
  return (result.rowCount ?? 0) > 0;
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
    throw new Error('CLOUD_SQL_* values are required in the isolated env file');
  }

  const identity = await ensureIdentityUser(args.email, {
    resetPassword: args.resetPassword,
    displayName: DEFAULT_ISOLATED_ADMIN_NAME,
  });
  if (identity.passwordSet && identity.password) {
    writeEnvKv(args.envFile, 'DEV_ENV_ADMIN_PASSWORD', identity.password);
  } else {
    deleteEnvKv(args.envFile, 'DEV_ENV_ADMIN_PASSWORD');
  }
  writeEnvKv(args.envFile, 'DEV_ENV_ADMIN_EMAIL', args.email);
  writeEnvKv(args.envFile, 'DEV_ENV_ADMIN_UID', identity.uid);

  const clientIdentity = await ensureIdentityUser(DEFAULT_PILOT_CLIENT_EMAIL, {
    resetPassword: false,
    displayName: `${DEFAULT_PILOT_CLIENT_FIRST_NAME} ${DEFAULT_PILOT_CLIENT_LAST_NAME}`,
  });
  if (clientIdentity.passwordSet && clientIdentity.password) {
    writeEnvKv(
      args.envFile,
      'DEV_ENV_CLIENT_PASSWORD',
      clientIdentity.password
    );
  }
  writeEnvKv(args.envFile, 'DEV_ENV_CLIENT_EMAIL', DEFAULT_PILOT_CLIENT_EMAIL);
  writeEnvKv(args.envFile, 'DEV_ENV_CLIENT_UID', clientIdentity.uid);

  const pool = new Pool({
    host,
    port,
    database,
    user,
    password,
    ssl: false,
  });
  try {
    await upsertAdmin(pool, args.email, identity.uid);
    await upsertPilotClient(pool, DEFAULT_PILOT_CLIENT_EMAIL, clientIdentity.uid);
    const retiredLegacy = await retireLegacyIsolatedAdmin(pool, args.email);
    if (retiredLegacy) {
      console.log(
        `Removed leftover isolated admin ${LEGACY_ISOLATED_ADMIN_EMAIL}`
      );
    }
  } finally {
    await pool.end();
  }

  console.log('Isolated admin login is ready.');
  console.log(`  email: ${args.email}`);
  console.log(`  identity uid: ${identity.uid}`);
  if (identity.created) {
    console.log('  Identity Platform user: created');
  } else {
    console.log('  Identity Platform user: already existed');
  }
  if (identity.passwordSet) {
    console.log(
      `  password: stored in ${args.envFile} as DEV_ENV_ADMIN_PASSWORD`
    );
  } else {
    console.log(
      '  password: unchanged. Use the existing Identity Platform password for this email.'
    );
  }
  console.log(
    '  Sign in on the CRM while VITE_APP_BACKEND_URL points at this isolated API (local npm run dev or sokana-private-api-dev).'
  );
  console.log('Pilot client is ready.');
  console.log(`  email: ${DEFAULT_PILOT_CLIENT_EMAIL}`);
  console.log(`  name: Maya Tester`);
  console.log(`  identity uid: ${clientIdentity.uid}`);
  if (clientIdentity.created) {
    console.log('  Identity Platform user: created');
  } else {
    console.log('  Identity Platform user: already existed');
  }
  if (clientIdentity.passwordSet) {
    console.log(
      `  password: stored in ${args.envFile} as DEV_ENV_CLIENT_PASSWORD`
    );
  } else {
    console.log(
      '  password: unchanged. Use the existing Identity Platform password for this email.'
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
