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

async function setClientPassword(email: string, password: string) {
  console.log(`🔐 Setting password for: ${email}\n`);

  try {
    // Step 1: Find the auth user by email
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
      console.error('❌ Error listing users:', listError);
      return;
    }

    const user = users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (!user) {
      console.error(`❌ User not found: ${email}`);
      console.log('\nAvailable users:');
      users?.slice(0, 10).forEach(u => {
        console.log(`  - ${u.email} (${u.id})`);
      });
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
