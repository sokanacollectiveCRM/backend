/**
 * Script to set password for a client user via Supabase Admin API
 *
 * Usage: npx tsx scripts/set-client-password.ts <email> <password>
 * Example: npx tsx scripts/set-client-password.ts jerry@jerrybony.me MyNewPassword123!
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function findUserByEmail(supabaseClient: ReturnType<typeof createClient>, email: string) {
  const target = email.toLowerCase();
  const perPage = 1000;
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await supabaseClient.auth.admin.listUsers({ page, perPage });
    if (error) return { user: undefined as undefined, error };
    const users = data?.users ?? [];
    const user = users.find((u) => (u.email || '').toLowerCase() === target);
    if (user) return { user, error: undefined };
    if (users.length < perPage) break;
  }
  return { user: undefined, error: undefined };
}

async function setClientPassword(email: string, password: string) {
  console.log(`🔐 Setting password for: ${email}\n`);

  try {
    // Step 1: Find the auth user by email (paginate — listUsers is paged)
    const { user, error: listError } = await findUserByEmail(supabase, email);

    if (listError) {
      console.error('❌ Error listing users:', listError);
      return;
    }

    if (!user) {
      console.error(`❌ User not found in Supabase Auth: ${email}`);
      console.log('(User must exist in Authentication → Users. Leads in Cloud SQL alone do not get a login.)');
      return;
    }

    console.log(`✅ Found user: ${user.email}`);
    console.log(`   User ID: ${user.id}`);
    console.log(`   Email confirmed: ${user.email_confirmed_at ? 'Yes' : 'No'}`);
    console.log(`   Has password: ${user.encrypted_password ? 'Yes' : 'No'}\n`);

    // Step 2: Update password using Admin API
    console.log('🔑 Setting new password...');
    const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      {
        password: password
      }
    );

    if (updateError) {
      console.error('❌ Error setting password:', updateError.message);
      return;
    }

    console.log('✅ Password set successfully!\n');
    console.log('📋 Login credentials:');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}\n`);
    console.log('💡 You can now log in with these credentials.');

  } catch (error: any) {
    console.error('❌ Unexpected error:', error.message);
  }
}

// Get email and password from command line arguments
const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.log('Usage: npx tsx scripts/set-client-password.ts <email> <password>');
  console.log('Example: npx tsx scripts/set-client-password.ts jerry@jerrybony.me MyPassword123!');
  process.exit(1);
}

setClientPassword(email, password).catch(console.error);
