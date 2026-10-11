#!/usr/bin/env npx tsx
/**
 * Create or remove the fictional scheduling pilot fixture on a **dev** database.
 *
 *   npx tsx scripts/dev-env/seed-scheduling-fixture.ts
 *   npx tsx scripts/dev-env/seed-scheduling-fixture.ts --cleanup
 *
 * Refuses to run unless NODE_ENV !== 'production' AND the target host /
 * database / instance name contains "dev". Does not send mail.
 *
 * Fixture emails (Jerry plus-addresses so real SMTP on dev lands in his inbox):
 *   jerry+sokanadoula@techluminateacademy.com
 *   jerry+sokanaclient@techluminateacademy.com
 *   jerry+sokanaadmin@techluminateacademy.com
 *
 * Identity Platform users are created only when Firebase Admin credentials
 * are already present. Passwords come from SCHEDULING_FIXTURE_PASSWORD
 * (never committed).
 */
import 'dotenv/config';
import { Pool } from 'pg';

import { assertDevSchedulingTarget } from '../../src/features/scheduling/application/devTargetGuard';

export const FIXTURE = {
  doulaEmail: 'jerry+sokanadoula@techluminateacademy.com',
  clientEmail: 'jerry+sokanaclient@techluminateacademy.com',
  adminEmail: 'jerry+sokanaadmin@techluminateacademy.com',
  doulaName: 'Maya Rivers',
  clientFirst: 'Jordan',
  clientLast: 'Lake',
  clientNumber: 'CL-PILOT-001',
  adminName: 'Pilot Admin',
} as const;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing ${name}`);
  }
  return value.trim();
}

function createPool(): Pool {
  return new Pool({
    host: requiredEnv('CLOUD_SQL_HOST'),
    port: parseInt(process.env.CLOUD_SQL_PORT || '5432', 10),
    database: requiredEnv('CLOUD_SQL_DATABASE'),
    user: requiredEnv('CLOUD_SQL_USER'),
    password: requiredEnv('CLOUD_SQL_PASSWORD'),
    ssl:
      (process.env.CLOUD_SQL_SSLMODE || 'disable').toLowerCase() === 'require'
        ? { rejectUnauthorized: false }
        : false,
  });
}

async function cleanup(pool: Pool): Promise<void> {
  const emails = [FIXTURE.doulaEmail, FIXTURE.clientEmail, FIXTURE.adminEmail];
  await pool.query(
    `DELETE FROM public.doula_booking_requests
     WHERE doula_id IN (SELECT id FROM public.doulas WHERE lower(email) = $1)
        OR client_id IN (SELECT id FROM public.phi_clients WHERE lower(email) = $2)`,
    [FIXTURE.doulaEmail, FIXTURE.clientEmail]
  );
  await pool.query(
    `DELETE FROM public.doula_availability
     WHERE doula_id IN (SELECT id FROM public.doulas WHERE lower(email) = $1)`,
    [FIXTURE.doulaEmail]
  );
  await pool.query(
    `DELETE FROM public.doula_assignments
     WHERE doula_id IN (SELECT id FROM public.doulas WHERE lower(email) = $1)
        OR client_id IN (SELECT id FROM public.phi_clients WHERE lower(email) = $2)`,
    [FIXTURE.doulaEmail, FIXTURE.clientEmail]
  );
  await pool.query(
    `DELETE FROM public.phi_contracts
     WHERE client_id IN (SELECT id FROM public.phi_clients WHERE lower(email) = $1)`,
    [FIXTURE.clientEmail]
  );
  await pool.query(`DELETE FROM public.phi_clients WHERE lower(email) = $1`, [
    FIXTURE.clientEmail,
  ]);
  await pool.query(`DELETE FROM public.doulas WHERE lower(email) = $1`, [
    FIXTURE.doulaEmail,
  ]);
  await pool.query(`DELETE FROM public.admins WHERE lower(email) = $1`, [
    FIXTURE.adminEmail,
  ]).catch(() => undefined);
  console.log('Removed scheduling fixture rows for', emails.join(', '));
}

async function maybeLinkIdentity(
  pool: Pool,
  table: 'doulas' | 'phi_clients' | 'admins',
  email: string
): Promise<string | null> {
  const password = process.env.SCHEDULING_FIXTURE_PASSWORD;
  if (!password) {
    console.log(
      `Skipping Identity Platform user for ${email} (set SCHEDULING_FIXTURE_PASSWORD to create).`
    );
    return null;
  }
  try {
    const { getFirebaseAuth } = await import(
      '../../src/services/identityPlatform/firebaseAdmin'
    );
    const auth = getFirebaseAuth();
    let user;
    try {
      user = await auth.getUserByEmail(email);
      await auth.updateUser(user.uid, { password, emailVerified: true });
    } catch {
      user = await auth.createUser({
        email,
        password,
        emailVerified: true,
        displayName:
          table === 'doulas'
            ? FIXTURE.doulaName
            : table === 'admins'
              ? FIXTURE.adminName
              : `${FIXTURE.clientFirst} ${FIXTURE.clientLast}`,
      });
    }
    await pool.query(
      `UPDATE public.${table}
          SET identity_platform_uid = $2
        WHERE lower(email) = $1`,
      [email, user.uid]
    );
    console.log(`Linked ${email} → Identity uid ${user.uid} (verified)`);
    return user.uid;
  } catch (error) {
    console.log(
      `Could not create/link Identity user for ${email}. Cloud SQL rows still exist.`,
      error instanceof Error ? error.message : ''
    );
    return null;
  }
}

async function seed(pool: Pool): Promise<void> {
  const doula = await pool.query<{ id: string }>(
    `
    INSERT INTO public.doulas (id, full_name, email, account_status, created_at, updated_at)
    SELECT gen_random_uuid(), $1, $2, 'approved', NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.doulas WHERE lower(email) = $2)
    RETURNING id
    `,
    [FIXTURE.doulaName, FIXTURE.doulaEmail]
  );
  const doulaId =
    doula.rows[0]?.id ??
    (
      await pool.query<{ id: string }>(
        `SELECT id FROM public.doulas WHERE lower(email) = $1 LIMIT 1`,
        [FIXTURE.doulaEmail]
      )
    ).rows[0].id;

  const client = await pool.query<{ id: string }>(
    `
    INSERT INTO public.phi_clients (
      id, first_name, last_name, email, client_number, created_at, updated_at
    )
    SELECT gen_random_uuid(), $1, $2, $3, $4, NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.phi_clients WHERE lower(email) = $3)
    RETURNING id
    `,
    [
      FIXTURE.clientFirst,
      FIXTURE.clientLast,
      FIXTURE.clientEmail,
      FIXTURE.clientNumber,
    ]
  );
  const clientId =
    client.rows[0]?.id ??
    (
      await pool.query<{ id: string }>(
        `SELECT id FROM public.phi_clients WHERE lower(email) = $1 LIMIT 1`,
        [FIXTURE.clientEmail]
      )
    ).rows[0].id;

  await pool.query(
    `
    INSERT INTO public.admins (id, full_name, first_name, last_name, email, created_at, updated_at)
    SELECT gen_random_uuid(), $1, 'Pilot', 'Admin', $2, NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM public.admins WHERE lower(email) = $2)
    `,
    [FIXTURE.adminName, FIXTURE.adminEmail]
  ).catch(() => undefined);

  await pool.query(
    `
    INSERT INTO public.doula_assignments (
      client_id, doula_id, role, services, assigned_at, status, ended_at
    )
    VALUES ($1::uuid, $2::uuid, 'primary', ARRAY['Labor Support']::text[], NOW(), 'active', NULL)
    ON CONFLICT (client_id, doula_id) DO UPDATE SET
      status = 'active',
      role = 'primary',
      ended_at = NULL,
      updated_at = NOW()
    `,
    [clientId, doulaId]
  ).catch(async () => {
    await pool.query(
      `
      INSERT INTO public.doula_assignments (client_id, doula_id, role, status)
      VALUES ($1::uuid, $2::uuid, 'primary', 'active')
      ON CONFLICT (client_id, doula_id) DO UPDATE SET status = 'active', role = 'primary'
      `,
      [clientId, doulaId]
    );
  });

  await pool.query(
    `
    INSERT INTO public.phi_contracts (id, client_id, status, created_at, updated_at)
    SELECT gen_random_uuid(), $1::uuid, 'draft', NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM public.phi_contracts WHERE client_id = $1::uuid
    )
    `,
    [clientId]
  ).catch(async () => {
    await pool.query(
      `
      INSERT INTO public.phi_contracts (id, client_id, created_at)
      SELECT gen_random_uuid(), $1::uuid, NOW()
      WHERE NOT EXISTS (SELECT 1 FROM public.phi_contracts WHERE client_id = $1::uuid)
      `,
      [clientId]
    );
  });

  await maybeLinkIdentity(pool, 'doulas', FIXTURE.doulaEmail);
  await maybeLinkIdentity(pool, 'phi_clients', FIXTURE.clientEmail);
  await maybeLinkIdentity(pool, 'admins', FIXTURE.adminEmail);

  console.log('Seeded scheduling fixture:');
  console.log(`  Doula  ${FIXTURE.doulaName} <${FIXTURE.doulaEmail}> id=${doulaId}`);
  console.log(
    `  Client ${FIXTURE.clientFirst} ${FIXTURE.clientLast} <${FIXTURE.clientEmail}> id=${clientId}`
  );
  console.log(`  Admin  ${FIXTURE.adminName} <${FIXTURE.adminEmail}>`);
  console.log('  Assignment: active primary');
  console.log('  Contract row: present (for BOOKING_REQUIRE_CONTRACT_STAGE=true)');
}

async function main(): Promise<void> {
  assertDevSchedulingTarget();
  const cleanupOnly = process.argv.includes('--cleanup');
  const pool = createPool();
  try {
    if (cleanupOnly) {
      await cleanup(pool);
    } else {
      await seed(pool);
    }
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
