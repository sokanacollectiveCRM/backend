/**
 * Migrate admin login accounts from Supabase Auth to GCP Identity Platform.
 *
 * Cloud SQL public.admins is the authoritative migration cohort and role store.
 * Supabase Auth is read only and used to verify the source identity/UID.
 *
 * Dry-run (default):
 *   npx tsx scripts/migrate-admin-auth-to-identity.ts
 *
 * Apply and send forced-reset emails:
 *   npx tsx scripts/migrate-admin-auth-to-identity.ts --apply
 *
 * Resend only to admins who have not signed in since a prior send:
 *   npx tsx scripts/migrate-admin-auth-to-identity.ts --apply \
 *     --only-pending-since=2026-08-26T16:05:00Z
 */
import 'dotenv/config';
import { Pool } from 'pg';

import { type User as SupabaseUser, createClient } from '@supabase/supabase-js';
import admin from 'firebase-admin';

import { NodemailerService } from '../src/services/emailService';

type AdminRow = {
  id: string;
  email: string;
  full_name: string;
};

type MigrationResult =
  | 'would_create'
  | 'would_update'
  | 'would_reset_existing_identity'
  | 'created'
  | 'updated'
  | 'reset_sent'
  | 'skipped_completed'
  | 'blocked_missing_supabase';

const APPLY = process.argv.includes('--apply');
const ONLY_PENDING_SINCE = (() => {
  const raw = process.argv
    .find((arg) => arg.startsWith('--only-pending-since='))
    ?.slice('--only-pending-since='.length);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid --only-pending-since timestamp: ${raw}`);
  }
  return parsed;
})();
const PROJECT_ID =
  process.env.IDENTITY_PLATFORM_PROJECT_ID ||
  process.env.GCLOUD_PROJECT ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  'sokana-private-data';

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function maskEmail(value: string): string {
  const [local, domain] = normalizeEmail(value).split('@');
  if (!domain) return '***';
  return `${local.slice(0, Math.min(2, local.length))}***@${domain}`;
}

function databasePool(): Pool {
  if (process.env.DATABASE_URL?.trim()) {
    return new Pool({ connectionString: process.env.DATABASE_URL.trim() });
  }
  return new Pool({
    host: process.env.CLOUD_SQL_HOST || '127.0.0.1',
    port: Number(process.env.CLOUD_SQL_PORT || 5433),
    database: requiredEnv('CLOUD_SQL_DATABASE'),
    user: requiredEnv('CLOUD_SQL_USER'),
    password: requiredEnv('CLOUD_SQL_PASSWORD'),
    ssl:
      process.env.CLOUD_SQL_SSLMODE === 'require'
        ? { rejectUnauthorized: false }
        : false,
  });
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
    if (error) {
      throw new Error(
        `Supabase listUsers failed on page ${page}: ${error.message}`
      );
    }
    users.push(...(data.users || []));
    if ((data.users || []).length < perPage) break;
  }
  return users;
}

async function listCloudSqlAdmins(pool: Pool): Promise<AdminRow[]> {
  const { rows } = await pool.query<AdminRow>(
    `SELECT id::text, lower(trim(email)) AS email, full_name
     FROM public.admins
     WHERE email IS NOT NULL AND trim(email) <> ''
     ORDER BY lower(trim(email))`
  );
  return rows;
}

function initializeFirebase(): admin.auth.Auth {
  if (!admin.apps.length) {
    admin.initializeApp({ projectId: PROJECT_ID });
  }
  return admin.auth();
}

async function findIdentityUser(
  auth: admin.auth.Auth,
  email: string
): Promise<admin.auth.UserRecord | null> {
  try {
    return await auth.getUserByEmail(email);
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === 'auth/user-not-found'
    ) {
      return null;
    }
    throw error;
  }
}

async function sendResetEmail(
  auth: admin.auth.Auth,
  emailService: NodemailerService,
  adminRow: AdminRow,
  frontendUrl: string
): Promise<void> {
  const link = await auth.generatePasswordResetLink(adminRow.email, {
    url: `${frontendUrl}/login`,
    handleCodeInApp: false,
  });
  const name = adminRow.full_name?.trim() || 'Sokana administrator';
  const text = [
    `Hello ${name},`,
    '',
    'Sokana has moved administrator login to Google Identity Platform.',
    'Set a new password using this one-time link:',
    link,
    '',
    'After setting your password, sign in and enter the verification code sent to your email.',
    'If you did not expect this migration email, contact Sokana support.',
  ].join('\n');
  const html = [
    `<p>Hello ${name},</p>`,
    '<p>Sokana has moved administrator login to Google Identity Platform.</p>',
    `<p><a href="${link}">Set your new Sokana password</a></p>`,
    '<p>After setting your password, sign in and enter the verification code sent to your email.</p>',
    '<p>If you did not expect this migration email, contact Sokana support.</p>',
  ].join('');
  await emailService.sendEmail(
    adminRow.email,
    'Set your new Sokana administrator password',
    text,
    html
  );
}

async function main(): Promise<void> {
  const pool = databasePool();
  try {
    const [admins, supabaseUsers] = await Promise.all([
      listCloudSqlAdmins(pool),
      listSupabaseUsers(),
    ]);
    const supabaseByEmail = new Map(
      supabaseUsers
        .filter((user) => user.email)
        .map((user) => [normalizeEmail(user.email!), user])
    );
    const identityAuth = initializeFirebase();
    const emailService = APPLY ? new NodemailerService() : null;
    const frontendUrl = (
      process.env.MIGRATION_FRONTEND_URL ||
      process.env.FRONTEND_URL ||
      'http://localhost:3001'
    ).replace(/\/$/, '');
    if (
      APPLY &&
      /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(frontendUrl) &&
      !process.argv.includes('--allow-local-links')
    ) {
      throw new Error(
        'Refusing to send localhost password-reset links. Set MIGRATION_FRONTEND_URL to the production frontend, or pass --allow-local-links intentionally.'
      );
    }
    const counts = new Map<MigrationResult, number>();

    console.log(
      JSON.stringify({
        mode: APPLY ? 'apply' : 'dry-run',
        projectId: PROJECT_ID,
        cloudSqlAdmins: admins.length,
        supabaseAuthUsers: supabaseUsers.length,
      })
    );

    for (const adminRow of admins) {
      const email = normalizeEmail(adminRow.email);
      const source = supabaseByEmail.get(email);
      const existing = await findIdentityUser(identityAuth, email);
      const lastSignInAt = existing?.metadata.lastSignInTime
        ? new Date(existing.metadata.lastSignInTime)
        : null;
      if (
        ONLY_PENDING_SINCE &&
        lastSignInAt &&
        lastSignInAt >= ONLY_PENDING_SINCE
      ) {
        counts.set(
          'skipped_completed',
          (counts.get('skipped_completed') || 0) + 1
        );
        console.log(
          JSON.stringify({
            email: maskEmail(email),
            result: 'skipped_completed',
            completionEvidence: 'signed_in_after_prior_send',
          })
        );
        continue;
      }
      if (!source) {
        if (existing) {
          if (!APPLY) {
            counts.set(
              'would_reset_existing_identity',
              (counts.get('would_reset_existing_identity') || 0) + 1
            );
            console.log(
              JSON.stringify({
                email: maskEmail(email),
                result: 'would_reset_existing_identity',
                roleSource: 'cloud_sql_admins',
              })
            );
            continue;
          }

          await identityAuth.updateUser(existing.uid, {
            email,
            displayName: adminRow.full_name || undefined,
            disabled: false,
          });
          await sendResetEmail(
            identityAuth,
            emailService!,
            adminRow,
            frontendUrl
          );
          counts.set('updated', (counts.get('updated') || 0) + 1);
          counts.set('reset_sent', (counts.get('reset_sent') || 0) + 1);
          console.log(
            JSON.stringify({
              email: maskEmail(email),
              result: 'reset_sent',
              source: 'existing_identity',
              roleSource: 'cloud_sql_admins',
            })
          );
          continue;
        }

        counts.set(
          'blocked_missing_supabase',
          (counts.get('blocked_missing_supabase') || 0) + 1
        );
        console.log(
          JSON.stringify({
            email: maskEmail(email),
            result: 'blocked_missing_supabase',
          })
        );
        continue;
      }

      if (!APPLY) {
        const result: MigrationResult = existing
          ? 'would_update'
          : 'would_create';
        counts.set(result, (counts.get(result) || 0) + 1);
        console.log(
          JSON.stringify({
            email: maskEmail(email),
            result,
            sourceUidMatchesCloudSql: source.id === adminRow.id,
            identityUidMatchesSource: existing?.uid === source.id,
          })
        );
        continue;
      }

      const identityUser = existing
        ? await identityAuth.updateUser(existing.uid, {
            email,
            displayName: adminRow.full_name || undefined,
            disabled: false,
          })
        : await identityAuth.createUser({
            // Preserve the Supabase UUID where possible; existing IdP users keep
            // their current UID and resolve their Cloud SQL role by email.
            uid: source.id,
            email,
            displayName: adminRow.full_name || undefined,
            emailVerified: Boolean(source.email_confirmed_at),
            disabled: false,
          });

      const changed: MigrationResult = existing ? 'updated' : 'created';
      counts.set(changed, (counts.get(changed) || 0) + 1);

      await sendResetEmail(identityAuth, emailService!, adminRow, frontendUrl);
      counts.set('reset_sent', (counts.get('reset_sent') || 0) + 1);
      console.log(
        JSON.stringify({
          email: maskEmail(email),
          result: 'reset_sent',
          identityUidMatchesSource: identityUser.uid === source.id,
          roleSource: 'cloud_sql_admins',
        })
      );
    }

    const summary = Object.fromEntries(counts);
    console.log(JSON.stringify({ summary }));
    if ((counts.get('blocked_missing_supabase') || 0) > 0) {
      throw new Error(
        'Migration blocked: one or more Cloud SQL admins are missing from Supabase Auth'
      );
    }
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
