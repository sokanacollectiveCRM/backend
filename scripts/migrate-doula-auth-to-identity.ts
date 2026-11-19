#!/usr/bin/env npx tsx
/**
 * Stage the approved doula cohort in GCP Identity Platform without notifying users.
 *
 * - Cloud SQL + the approved transfer manifest define the cohort and profile data.
 * - Supabase Auth is read-only and supplies the legacy UID when one exists.
 * - New Identity Platform users are disabled and have no password.
 * - No invitation, verification, or password-reset links/emails are generated.
 *
 * Dry run: npx tsx scripts/migrate-doula-auth-to-identity.ts
 * Apply:   npx tsx scripts/migrate-doula-auth-to-identity.ts --apply
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

import { type User as SupabaseUser, createClient } from '@supabase/supabase-js';
import admin from 'firebase-admin';

interface DoulaRow {
  id: string;
  full_name: string;
  email: string;
  account_status: string;
  identity_platform_uid: string | null;
}

interface AdminIdentityBoundary {
  id: string;
  email: string;
  identity_platform_uid: string | null;
}

type PlanStatus =
  | 'would_create_from_supabase'
  | 'would_create_cloud_sql_only'
  | 'would_link_existing'
  | 'already_staged'
  | 'conflict_admin_identity'
  | 'conflict_identity_uid'
  | 'conflict_identity_email'
  | 'conflict_existing_link';

interface MigrationPlan {
  doula: DoulaRow;
  source: SupabaseUser | null;
  desiredUid: string;
  existing: admin.auth.UserRecord | null;
  status: PlanStatus;
}

const APPLY = process.argv.includes('--apply');
const PROJECT_ID =
  process.env.IDENTITY_PLATFORM_PROJECT_ID ||
  process.env.GCLOUD_PROJECT ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  'sokana-private-data';
const MANIFEST_PATH = path.resolve(
  process.cwd(),
  'outputs/doula-cloudsql-transfer-2026-09-06/approved-transfer.csv'
);

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function normalizeEmail(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function databasePool(): Pool {
  return new Pool({
    host: requiredEnv('CLOUD_SQL_HOST'),
    port: Number(process.env.CLOUD_SQL_PORT || 5432),
    database: requiredEnv('CLOUD_SQL_DATABASE'),
    user: requiredEnv('CLOUD_SQL_USER'),
    password: requiredEnv('CLOUD_SQL_PASSWORD'),
    ssl:
      process.env.CLOUD_SQL_SSLMODE === 'require'
        ? { rejectUnauthorized: false }
        : false,
  });
}

function loadManifestEmails(): string[] {
  if (!fs.existsSync(MANIFEST_PATH)) {
    throw new Error(`Approved doula manifest not found: ${MANIFEST_PATH}`);
  }
  const lines = fs
    .readFileSync(MANIFEST_PATH, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(1);
  const emails = lines.map((line) => normalizeEmail(line.split(',')[2]));
  if (emails.some((email) => !email || !email.includes('@'))) {
    throw new Error('Approved doula manifest contains an invalid email');
  }
  if (new Set(emails).size !== emails.length) {
    throw new Error('Approved doula manifest contains duplicate emails');
  }
  return emails;
}

async function loadCloudSqlCohort(
  pool: Pool,
  manifestEmails: string[]
): Promise<DoulaRow[]> {
  const { rows } = await pool.query<DoulaRow>(
    `SELECT id::text, full_name, lower(trim(email)) AS email,
            account_status, identity_platform_uid
       FROM public.doulas
      WHERE lower(trim(email)) = ANY($1::text[])
      ORDER BY lower(trim(email))`,
    [manifestEmails]
  );
  if (rows.length !== manifestEmails.length) {
    throw new Error(
      `Cloud SQL cohort mismatch: expected ${manifestEmails.length}, found ${rows.length}`
    );
  }
  if (rows.some((row) => normalizeEmail(row.account_status) !== 'approved')) {
    throw new Error('Cloud SQL cohort contains a non-approved doula');
  }
  return rows;
}

async function loadAdminBoundary(pool: Pool): Promise<AdminIdentityBoundary[]> {
  const { rows } = await pool.query<AdminIdentityBoundary>(
    `SELECT id::text, lower(trim(email)) AS email, identity_platform_uid
       FROM public.admins`
  );
  return rows;
}

async function listSupabaseUsers(): Promise<SupabaseUser[]> {
  const client = createClient(
    requiredEnv('SUPABASE_URL'),
    requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
  const users: SupabaseUser[] = [];
  const perPage = 200;
  for (let page = 1; ; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) throw new Error(`Supabase listUsers failed: ${error.message}`);
    users.push(...(data.users || []));
    if ((data.users || []).length < perPage) break;
  }
  return users;
}

async function listIdentityUsers(
  auth: admin.auth.Auth
): Promise<admin.auth.UserRecord[]> {
  const users: admin.auth.UserRecord[] = [];
  let pageToken: string | undefined;
  do {
    const page = await auth.listUsers(1000, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);
  return users;
}

function initializeFirebase(): admin.auth.Auth {
  if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT_ID });
  return admin.auth();
}

function buildPlans(input: {
  doulas: DoulaRow[];
  admins: AdminIdentityBoundary[];
  supabaseUsers: SupabaseUser[];
  identityUsers: admin.auth.UserRecord[];
}): MigrationPlan[] {
  const supabaseByUid = new Map(
    input.supabaseUsers.map((user) => [user.id, user])
  );
  const supabaseByEmail = new Map(
    input.supabaseUsers
      .filter((user) => user.email)
      .map((user) => [normalizeEmail(user.email), user])
  );
  const identityByUid = new Map(
    input.identityUsers.map((user) => [user.uid, user])
  );
  const identityByEmail = new Map(
    input.identityUsers
      .filter((user) => user.email)
      .map((user) => [normalizeEmail(user.email), user])
  );
  const adminUids = new Set(
    input.admins.flatMap((row) =>
      [row.id, row.identity_platform_uid].filter((id): id is string =>
        Boolean(id)
      )
    )
  );
  const adminEmails = new Set(
    input.admins.map((row) => normalizeEmail(row.email))
  );

  return input.doulas.map((doula) => {
    const email = normalizeEmail(doula.email);
    const source =
      supabaseByUid.get(doula.id) ?? supabaseByEmail.get(email) ?? null;
    const desiredUid = source?.id ?? doula.id;
    const byUid = identityByUid.get(desiredUid) ?? null;
    const byEmail = identityByEmail.get(email) ?? null;
    const existing = byUid ?? byEmail;

    let status: PlanStatus;
    if (
      (existing && (adminUids.has(existing.uid) || adminEmails.has(email))) ||
      adminUids.has(desiredUid)
    ) {
      status = 'conflict_admin_identity';
    } else if (byUid && byEmail && byUid.uid !== byEmail.uid) {
      status = 'conflict_identity_uid';
    } else if (byEmail && byEmail.uid !== desiredUid) {
      status = 'conflict_identity_email';
    } else if (
      doula.identity_platform_uid &&
      doula.identity_platform_uid !== (existing?.uid ?? desiredUid)
    ) {
      status = 'conflict_existing_link';
    } else if (
      existing &&
      doula.identity_platform_uid === existing.uid &&
      existing.disabled
    ) {
      status = 'already_staged';
    } else if (existing) {
      status = 'would_link_existing';
    } else if (source) {
      status = 'would_create_from_supabase';
    } else {
      status = 'would_create_cloud_sql_only';
    }

    return { doula, source, desiredUid, existing, status };
  });
}

const CONFLICTS = new Set<PlanStatus>([
  'conflict_admin_identity',
  'conflict_identity_uid',
  'conflict_identity_email',
  'conflict_existing_link',
]);

async function applyPlan(
  auth: admin.auth.Auth,
  pool: Pool,
  plan: MigrationPlan
): Promise<'created' | 'linked' | 'already_staged'> {
  if (plan.status === 'already_staged') return 'already_staged';
  if (CONFLICTS.has(plan.status)) {
    throw new Error(`Refusing conflicting migration plan: ${plan.status}`);
  }

  const identityUser = plan.existing
    ? await auth.updateUser(plan.existing.uid, {
        displayName: plan.doula.full_name || undefined,
        disabled: true,
      })
    : await auth.createUser({
        uid: plan.desiredUid,
        email: plan.doula.email,
        displayName: plan.doula.full_name || undefined,
        emailVerified: Boolean(plan.source?.email_confirmed_at),
        disabled: true,
      });

  const result = await pool.query(
    `UPDATE public.doulas
        SET identity_platform_uid = $1, updated_at = NOW()
      WHERE id = $2::uuid
        AND (identity_platform_uid IS NULL OR identity_platform_uid = $1)`,
    [identityUser.uid, plan.doula.id]
  );
  if ((result.rowCount ?? 0) !== 1) {
    throw new Error('Failed to persist an unambiguous Cloud SQL doula link');
  }
  return plan.existing ? 'linked' : 'created';
}

function summarize(values: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

async function main(): Promise<void> {
  const pool = databasePool();
  try {
    const manifestEmails = loadManifestEmails();
    const auth = initializeFirebase();
    const [doulas, admins, supabaseUsers, identityUsers] = await Promise.all([
      loadCloudSqlCohort(pool, manifestEmails),
      loadAdminBoundary(pool),
      listSupabaseUsers(),
      listIdentityUsers(auth),
    ]);
    const plans = buildPlans({
      doulas,
      admins,
      supabaseUsers,
      identityUsers,
    });
    const conflicts = plans.filter((plan) => CONFLICTS.has(plan.status));

    console.log(
      JSON.stringify(
        {
          mode: APPLY ? 'apply' : 'dry-run',
          projectId: PROJECT_ID,
          manifestDoulas: manifestEmails.length,
          cloudSqlApprovedDoulas: doulas.length,
          sourceSupabaseAccounts: plans.filter((plan) => plan.source).length,
          existingIdentityAccounts: identityUsers.length,
          plan: summarize(plans.map((plan) => plan.status)),
          emailsSent: 0,
          passwordsSet: 0,
        },
        null,
        2
      )
    );

    if (!APPLY) return;
    if (conflicts.length > 0) {
      throw new Error(
        `Apply blocked: ${conflicts.length} identity conflict(s) require review`
      );
    }

    const results: string[] = [];
    for (const plan of plans) {
      results.push(await applyPlan(auth, pool, plan));
    }
    console.log(
      JSON.stringify(
        {
          result: summarize(results),
          migrated: results.length,
          disabledUntilNotification: results.length,
          emailsSent: 0,
          passwordsSet: 0,
        },
        null,
        2
      )
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    })
  );
  process.exit(1);
});
