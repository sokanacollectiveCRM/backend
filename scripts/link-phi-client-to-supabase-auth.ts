/**
 * Find a client in Cloud SQL (phi_clients) by email, ensure a Supabase Auth user exists,
 * and set phi_clients.user_id to that auth user id (portal / client login).
 *
 * Also sets Supabase Auth user_metadata + app_metadata role to `client`, and upserts
 * public.users (if present) so backend /auth/login returns role client — not admin UI.
 *
 * Usage:
 *   NEW_CLIENT_PASSWORD='YourSecurePass123!' npx tsx scripts/link-phi-client-to-supabase-auth.ts jbony@icstars.org
 *
 * Requires: .env with CLOUD_SQL_*, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Requires: Cloud SQL Proxy if connecting to localhost:5433
 */

import 'dotenv/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Pool } from 'pg';
import * as crypto from 'crypto';

const EMAIL = (process.argv[2] || '').trim().toLowerCase();
let PASSWORD = process.env.NEW_CLIENT_PASSWORD?.trim() || '';

function randomPassword(): string {
  return crypto.randomBytes(18).toString('base64url') + 'Aa1!';
}

async function findAuthUserByEmail(supabase: SupabaseClient, email: string) {
  const target = email.toLowerCase();
  const perPage = 1000;
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) return { user: undefined, error };
    const users = data?.users ?? [];
    const user = users.find((u) => (u.email || '').toLowerCase() === target);
    if (user) return { user, error: undefined };
    if (users.length < perPage) break;
  }
  return { user: undefined, error: undefined };
}

/** Backend login uses public.users by email first; keep id = auth user id and role = client. */
async function ensurePublicUsersClientRow(
  supabase: SupabaseClient,
  authUserId: string,
  email: string,
  first: string | null,
  last: string | null
): Promise<void> {
  const payload = {
    id: authUserId,
    email: email.toLowerCase().trim(),
    firstname: (first || '').trim() || email.split('@')[0],
    lastname: (last || '').trim(),
    role: 'client',
    account_status: 'active',
  };
  const { error } = await supabase.from('users').upsert(payload, { onConflict: 'id' });
  if (error) {
    console.warn('public.users upsert skipped:', error.message);
    console.warn('(If public.users is missing, backend still uses Auth metadata when findByEmail returns null.)');
  } else {
    console.log('public.users: upserted id=%s role=client', authUserId);
  }
}

async function main() {
  if (!EMAIL) {
    console.error('Usage: NEW_CLIENT_PASSWORD=... npx tsx scripts/link-phi-client-to-supabase-auth.ts <email>');
    process.exit(1);
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const host = process.env.CLOUD_SQL_HOST || '127.0.0.1';
  const port = parseInt(process.env.CLOUD_SQL_PORT || '5433', 10);
  const database = process.env.CLOUD_SQL_DATABASE || 'sokana_private';
  const user = process.env.CLOUD_SQL_USER || 'app_user';
  const password = process.env.CLOUD_SQL_PASSWORD;
  if (!password) {
    console.error('Missing CLOUD_SQL_PASSWORD');
    process.exit(1);
  }

  if (!PASSWORD || PASSWORD.length < 8) {
    PASSWORD = randomPassword();
    console.log('(No NEW_CLIENT_PASSWORD — generated a one-time password; save it now.)\n');
  }

  const pool = new Pool({
    host,
    port,
    database,
    user,
    password,
    ssl: false,
  });

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { rows } = await pool.query<{
      id: string;
      email: string | null;
      first_name: string | null;
      last_name: string | null;
      user_id: string | null;
    }>(
      `SELECT id, email, first_name, last_name, user_id
       FROM public.phi_clients
       WHERE lower(trim(coalesce(email, ''))) = lower(trim($1))
       ORDER BY updated_at DESC NULLS LAST
       LIMIT 1`,
      [EMAIL]
    );

    const phi = rows[0];
    if (!phi) {
      console.error(`No phi_clients row found for email: ${EMAIL}`);
      process.exit(1);
    }

    console.log('Cloud SQL client:', {
      id: phi.id,
      email: phi.email,
      name: `${phi.first_name || ''} ${phi.last_name || ''}`.trim(),
      existing_user_id: phi.user_id || '(null)',
    });

    let authUserId: string;

    const { user: existingAuth, error: listErr } = await findAuthUserByEmail(supabase, EMAIL);
    if (listErr) {
      console.error('Supabase listUsers error:', listErr.message);
      process.exit(1);
    }

    const clientUserMeta = {
      role: 'client' as const,
      client_id: phi.id,
      firstname: (phi.first_name || '').trim(),
      lastname: (phi.last_name || '').trim(),
    };
    const clientAppMeta = { role: 'client' as const };

    if (existingAuth) {
      authUserId = existingAuth.id;
      console.log('Supabase Auth user already exists:', authUserId);

      const { error: pwdErr } = await supabase.auth.admin.updateUserById(authUserId, {
        password: PASSWORD,
        email_confirm: true,
        // Force client role (do not preserve prior admin/doula from spread)
        user_metadata: {
          ...((existingAuth.user_metadata as Record<string, unknown>) || {}),
          ...clientUserMeta,
        },
        app_metadata: {
          ...((existingAuth.app_metadata as Record<string, unknown>) || {}),
          ...clientAppMeta,
        },
      });
      if (pwdErr) {
        console.error('Failed to update password / metadata:', pwdErr.message);
        process.exit(1);
      }
      console.log('Password, user_metadata (role=client), and app_metadata updated.');
    } else {
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email: phi.email || EMAIL,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: clientUserMeta,
        app_metadata: clientAppMeta,
      });

      if (createErr) {
        console.error('createUser failed:', createErr.message);
        process.exit(1);
      }
      if (!created.user?.id) {
        console.error('createUser returned no user id');
        process.exit(1);
      }
      authUserId = created.user.id;
      console.log('Created Supabase Auth user:', authUserId);
    }

    if (phi.user_id && phi.user_id !== authUserId) {
      console.error(
        `Conflict: phi_clients.user_id is ${phi.user_id} but Auth user for this email is ${authUserId}. Fix manually.`
      );
      process.exit(1);
    }

    if (!phi.user_id || phi.user_id !== authUserId) {
      const { rowCount } = await pool.query(
        `UPDATE public.phi_clients
         SET user_id = $1::uuid, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2::uuid`,
        [authUserId, phi.id]
      );
      if (rowCount === 0) {
        console.error('UPDATE phi_clients failed');
        process.exit(1);
      }
      console.log('Linked phi_clients.user_id →', authUserId);
    } else {
      console.log('phi_clients.user_id already set correctly.');
    }

    await ensurePublicUsersClientRow(
      supabase,
      authUserId,
      phi.email || EMAIL,
      phi.first_name,
      phi.last_name
    );

    console.log('\n✅ Done. Login:');
    console.log('   Email:', phi.email || EMAIL);
    console.log('   Password:', PASSWORD);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
