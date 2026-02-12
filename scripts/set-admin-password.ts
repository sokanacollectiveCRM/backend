/**
 * One-off: set Supabase Auth password for an admin user by email.
 * Uses SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.
 *
 * Usage: npx tsx scripts/set-admin-password.ts
 * Env: ADMIN_EMAIL (default jerrybony5@gmail.com), ADMIN_NEW_PASSWORD (required)
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'jerrybony5@gmail.com').trim().toLowerCase();
const NEW_PASSWORD = process.env.ADMIN_NEW_PASSWORD;

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
  }
  if (!NEW_PASSWORD || NEW_PASSWORD.length < 8) {
    console.error('Set ADMIN_NEW_PASSWORD in env (min 8 chars). Example: ADMIN_NEW_PASSWORD=YourPass npx tsx scripts/set-admin-password.ts');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) {
    console.error('Failed to list users:', listErr.message);
    process.exit(1);
  }

  const user = list.users.find((u) => (u.email || '').toLowerCase() === ADMIN_EMAIL);
  if (!user) {
    console.error(`No Supabase Auth user found with email: ${ADMIN_EMAIL}`);
    process.exit(1);
  }

  const { error: updateErr } = await supabase.auth.admin.updateUserById(user.id, {
    password: NEW_PASSWORD,
  });
  if (updateErr) {
    console.error('Failed to update password:', updateErr.message);
    process.exit(1);
  }

  console.log(`Password updated for ${ADMIN_EMAIL} (id: ${user.id}). You can log in with that password now.`);
}

main();
