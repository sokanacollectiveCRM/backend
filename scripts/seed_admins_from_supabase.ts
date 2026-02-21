import 'dotenv/config';

import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';

type TargetAdmin = {
  email: string;
  fullName: string;
};

type SupabaseAdminUser = {
  id: string;
  email?: string | null;
};

const TARGET_ADMINS: TargetAdmin[] = [
  { email: 'nancy@sokanacollective.com', fullName: 'Nancy Cowans' },
  { email: 'sonia@sokanacollective.com', fullName: 'Sonia Collins' },
];

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function fetchAllAuthUsers(
  supabaseUrl: string,
  supabaseServiceRoleKey: string
): Promise<SupabaseAdminUser[]> {
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const allUsers: SupabaseAdminUser[] = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(`Supabase listUsers failed on page ${page}: ${error.message}`);
    }

    const users = (data?.users || []) as SupabaseAdminUser[];
    allUsers.push(...users);

    // Stop when final page is reached.
    if (users.length < perPage) {
      break;
    }

    page += 1;
  }

  return allUsers;
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const databaseUrl = process.env.DATABASE_URL || '';

  if (!supabaseUrl || !supabaseServiceRoleKey || !databaseUrl) {
    throw new Error('Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL');
  }

  const allUsers = await fetchAllAuthUsers(supabaseUrl, supabaseServiceRoleKey);
  console.log(`Fetched ${allUsers.length} Supabase auth user(s).`);

  const byEmail = new Map<string, SupabaseAdminUser>();
  for (const user of allUsers) {
    if (!user.email) continue;
    byEmail.set(normalizeEmail(user.email), user);
  }

  const missingEmails: string[] = [];
  const foundAdmins: Array<{ id: string; email: string; fullName: string }> = [];

  for (const target of TARGET_ADMINS) {
    const email = normalizeEmail(target.email);
    const found = byEmail.get(email);
    if (!found) {
      missingEmails.push(email);
      continue;
    }
    foundAdmins.push({ id: found.id, email, fullName: target.fullName });
  }

  if (missingEmails.length > 0) {
    console.error(`Missing required Supabase auth users: ${missingEmails.join(', ')}`);
    process.exit(1);
  }

  console.log(`Found target admins: ${foundAdmins.map((a) => a.email).join(', ')}`);

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    for (const admin of foundAdmins) {
      await pool.query(
        `
        INSERT INTO public.admins (id, full_name, email, phone, created_at, updated_at)
        VALUES ($1,$2,$3,$4, now(), now())
        ON CONFLICT (email) DO UPDATE SET
          id = EXCLUDED.id,
          full_name = EXCLUDED.full_name,
          phone = EXCLUDED.phone,
          updated_at = now()
        `,
        [admin.id, admin.fullName, admin.email, null]
      );
    }

    console.log(`Upserted ${foundAdmins.length} admin row(s) into public.admins.`);

    const { rows } = await pool.query<{
      id: string;
      full_name: string;
      email: string;
      updated_at: string;
    }>(
      `
      SELECT id, full_name, email, updated_at
      FROM public.admins
      ORDER BY updated_at DESC
      `
    );

    console.log('Verification rows (public.admins):');
    for (const row of rows) {
      console.log(`- ${row.email} | ${row.full_name} | ${row.id} | ${row.updated_at}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`FAIL: ${(error as Error).message}`);
  process.exit(1);
});
