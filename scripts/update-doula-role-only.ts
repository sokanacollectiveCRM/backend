/**
 * Simple script to update existing user's role to 'doula'
 * Use this if the user already exists and you just need to update the role
 *
 * Usage: npx tsx scripts/update-doula-role-only.ts
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const TEST_EMAIL = process.env.TEST_DOULA_EMAIL || 'jerry@techluminateacademy.com';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function updateDoulaRole() {
  console.log('🔄 Updating user role to doula...\n');
  console.log(`Email: ${TEST_EMAIL}\n`);

  try {
    // Find user by email
    const { data: user, error: findError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', TEST_EMAIL)
      .single();

    if (findError || !user) {
      console.error('❌ User not found in users table');
      console.error('   Make sure the user exists in Supabase Auth first');
      process.exit(1);
    }

    console.log(`Found user: ${user.firstname} ${user.lastname}`);
    console.log(`Current role: ${user.role || 'null'}\n`);

    // Update role
    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from('users')
      .update({ role: 'doula' })
      .eq('id', user.id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    console.log('✅ Role updated successfully!');
    console.log(`\n📊 Updated User:`);
    console.log(`   ID: ${updatedUser.id}`);
    console.log(`   Email: ${updatedUser.email}`);
    console.log(`   Name: ${updatedUser.firstname} ${updatedUser.lastname}`);
    console.log(`   Role: ${updatedUser.role}`);
    console.log('\n💡 Note: If login still fails, you may need to reset the password in Supabase Dashboard');
    console.log('   Go to: Authentication > Users > Find user > Reset Password');

  } catch (error: any) {
    console.error('\n❌ Error updating role:');
    console.error(error.message);
    process.exit(1);
  }
}

updateDoulaRole();
