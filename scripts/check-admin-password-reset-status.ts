/**
 * Read-only check of admin password-reset completion after a migration email.
 *
 * Usage:
 *   npx tsx scripts/check-admin-password-reset-status.ts --sent-at=2026-08-26T16:05:00Z
 */
import 'dotenv/config';
import { Pool } from 'pg';

import admin from 'firebase-admin';

type AdminRow = {
  email: string;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function maskEmail(value: string): string {
  const [local, domain] = value.trim().toLowerCase().split('@');
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

function parseSentAt(): Date {
  const raw = process.argv
    .find((arg) => arg.startsWith('--sent-at='))
    ?.slice('--sent-at='.length);
  if (!raw) throw new Error('Missing required --sent-at=<ISO timestamp>');
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid --sent-at timestamp: ${raw}`);
  }
  return date;
}

async function main(): Promise<void> {
  const sentAt = parseSentAt();
  const projectId =
    process.env.IDENTITY_PLATFORM_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    'sokana-private-data';
  if (!admin.apps.length) admin.initializeApp({ projectId });

  const pool = databasePool();
  try {
    const { rows } = await pool.query<AdminRow>(
      `SELECT lower(trim(email)) AS email
       FROM public.admins
       WHERE email IS NOT NULL AND trim(email) <> ''
       ORDER BY lower(trim(email))`
    );

    let completed = 0;
    const results = [];
    for (const row of rows) {
      const user = await admin.auth().getUserByEmail(row.email);
      const metadata = user.metadata as admin.auth.UserMetadata & {
        passwordUpdatedAt?: string;
      };
      const passwordUpdatedAt = metadata.passwordUpdatedAt
        ? new Date(metadata.passwordUpdatedAt)
        : null;
      const completedAfterEmail = Boolean(
        passwordUpdatedAt && passwordUpdatedAt >= sentAt
      );
      const lastSignInAt = metadata.lastSignInTime
        ? new Date(metadata.lastSignInTime)
        : null;
      const signedInAfterEmail = Boolean(
        lastSignInAt && lastSignInAt >= sentAt
      );
      const completionEvidence = completedAfterEmail || signedInAfterEmail;
      if (completionEvidence) completed += 1;
      results.push({
        email: maskEmail(row.email),
        completionEvidence,
        completedAfterEmail,
        signedInAfterEmail,
        hasPasswordCredential: Boolean(user.passwordHash),
        creationTime: metadata.creationTime,
        passwordUpdatedAt: metadata.passwordUpdatedAt || null,
        lastSignInTime: metadata.lastSignInTime || null,
        tokensValidAfterTime: user.tokensValidAfterTime || null,
        disabled: user.disabled,
      });
    }

    console.log(
      JSON.stringify(
        {
          mode: 'read-only',
          projectId,
          sentAt: sentAt.toISOString(),
          adminCount: rows.length,
          completionEvidenceCount: completed,
          pendingEvidenceCount: rows.length - completed,
          results,
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
