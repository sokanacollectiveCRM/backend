/**
 * Verify an Identity Platform + Cloud SQL staff user for auth cutover.
 * Usage: npx tsx scripts/verify-identity-staff-user.ts jerry@example.com
 * Prints only non-secret status fields.
 */
import 'dotenv/config';
import { Client } from 'pg';

import admin from 'firebase-admin';

async function main(): Promise<void> {
  const email = (process.argv[2] || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    console.error(
      'Usage: npx tsx scripts/verify-identity-staff-user.ts <email>'
    );
    process.exit(1);
  }

  const projectId =
    process.env.IDENTITY_PLATFORM_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    'sokana-private-data';

  if (!admin.apps.length) {
    admin.initializeApp({ projectId });
  }

  let idp: Record<string, unknown> = { ok: false };
  try {
    const u = await admin.auth().getUserByEmail(email);
    idp = {
      ok: true,
      uid: u.uid,
      email: u.email,
      emailVerified: u.emailVerified,
      disabled: u.disabled,
      providerIds: (u.providerData || []).map((p) => p.providerId),
    };
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    idp = {
      ok: false,
      code: err.code || null,
      message: err.message || String(e),
    };
  }

  const client = new Client({
    host: process.env.CLOUD_SQL_HOST || '127.0.0.1',
    port: parseInt(process.env.CLOUD_SQL_PORT || '5433', 10),
    database: process.env.CLOUD_SQL_DATABASE || 'sokana_private',
    user: process.env.CLOUD_SQL_USER || 'app_user',
    password: process.env.CLOUD_SQL_PASSWORD,
    ssl:
      process.env.CLOUD_SQL_SSLMODE === 'require'
        ? { rejectUnauthorized: false }
        : false,
  });

  let cloudSql: Record<string, unknown> = { ok: false };
  try {
    await client.connect();
    const { rows } = await client.query(
      `SELECT 'admins' AS source, id::text AS id, email, full_name
       FROM public.admins
       WHERE lower(email) = $1
       UNION ALL
       SELECT 'doulas' AS source, id::text AS id, email, full_name
       FROM public.doulas
       WHERE lower(email) = $1`,
      [email]
    );
    cloudSql = {
      ok: rows.length > 0,
      matches: rows,
    };

    const mfa = await client.query(
      `SELECT to_regclass('public.auth_mfa_challenges') IS NOT NULL AS exists`
    );
    cloudSql.mfaTableExists = Boolean(mfa.rows[0]?.exists);
  } catch (e: unknown) {
    cloudSql = {
      ok: false,
      message: e instanceof Error ? e.message : String(e),
    };
  } finally {
    await client.end().catch(() => undefined);
  }

  const ready =
    idp.ok === true && cloudSql.ok === true && cloudSql.mfaTableExists === true;

  console.log(
    JSON.stringify(
      {
        email,
        projectId,
        identityPlatform: idp,
        cloudSql,
        readyForIdentityLogin: ready,
      },
      null,
      2
    )
  );

  process.exit(ready ? 0 : 1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
