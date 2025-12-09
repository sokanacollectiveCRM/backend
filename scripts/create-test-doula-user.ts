/**
 * Script to create a test doula user in Supabase
 *
 * Usage: npx tsx scripts/create-test-doula-user.ts
 *
 * This script:
 * 1. Creates an auth user in Supabase Auth
 * 2. Creates a corresponding user record in the users table with role='doula'
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('   Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Test user credentials
const TEST_EMAIL = process.env.TEST_DOULA_EMAIL || 'jerry@techluminateacademy.com';
const TEST_PASSWORD = process.env.TEST_DOULA_PASSWORD || '@Bony5690';
const TEST_FIRSTNAME = 'Jerry';
const TEST_LASTNAME = 'Bony';

// Create Supabase admin client
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function createTestDoulaUser() {
  console.log('🚀 Creating test doula user...\n');
  console.log(`Email: ${TEST_EMAIL}`);
  console.log(`Password: ${TEST_PASSWORD}`);
  console.log(`Name: ${TEST_FIRSTNAME} ${TEST_LASTNAME}\n`);

  try {
    // Step 1: Create auth user
    console.log('📝 Step 1: Creating auth user...');
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        role: 'doula',
        firstname: TEST_FIRSTNAME,
        lastname: TEST_LASTNAME,
      },
    });

    let userId: string;

    if (authError) {
      if (authError.message.includes('already registered') || authError.message.includes('already been registered')) {
        console.log('⚠️  Auth user already exists, retrieving existing user...');

        // Get user ID from auth.users (this is the source of truth)
        console.log('   Searching auth.users...');
        const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();

        if (listError) {
          throw new Error(`Could not retrieve user: ${listError.message}`);
        }

        const foundUser = authUsers.users.find(u => u.email === TEST_EMAIL);
        if (!foundUser) {
          throw new Error('User email exists but could not find user in auth.users');
        }

        userId = foundUser.id;
        console.log(`✅ Found existing auth user with ID: ${userId}`);

        // Update password for existing user
        console.log('📝 Updating password for existing user...');
        const { data: updateData, error: updatePasswordError } = await supabaseAdmin.auth.admin.updateUserById(
          userId,
          {
            password: TEST_PASSWORD,
            email_confirm: true // Ensure email is confirmed
          }
        );

        if (updatePasswordError) {
          console.log(`⚠️  Warning: Could not update password: ${updatePasswordError.message}`);
          console.log('   You may need to reset the password manually in Supabase Dashboard');
          console.log('   Go to: Authentication > Users > Find user > Reset Password');
        } else {
          console.log('✅ Password updated successfully');
        }
        console.log(''); // Empty line
      } else {
        throw authError;
      }
    } else {
      if (!authData.user) {
        throw new Error('Failed to create auth user');
      }
      userId = authData.user.id;
      console.log(`✅ Auth user created with ID: ${userId}\n`);
    }


    // Step 2: Create/Update user record in users table
    console.log('📝 Step 2: Creating/updating user record in users table...');

    // First check if user exists
    const { data: existingUserRecord } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    let userData;

    if (existingUserRecord) {
      // Update existing user
      console.log('⚠️  User record already exists, updating...');
      const { data: updatedUser, error: updateError } = await supabaseAdmin
        .from('users')
        .update({
          email: TEST_EMAIL,
          firstname: TEST_FIRSTNAME,
          lastname: TEST_LASTNAME,
          role: 'doula',
        })
        .eq('id', userId)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }
      userData = updatedUser;
      console.log(`✅ User record updated successfully\n`);
    } else {
      // Create new user record
      const { data: newUser, error: userError } = await supabaseAdmin
        .from('users')
        .insert({
          id: userId,
          email: TEST_EMAIL,
          firstname: TEST_FIRSTNAME,
          lastname: TEST_LASTNAME,
          role: 'doula',
        })
        .select()
        .single();

      if (userError) {
        throw userError;
      }
      userData = newUser;
      console.log(`✅ User record created successfully\n`);
    }

    console.log('📊 User Details:');
    console.log(JSON.stringify(userData, null, 2));

    // Step 3: Verify the user can be found by email
    console.log('\n📝 Step 3: Verifying user lookup...');
    const { data: verifyUser, error: verifyError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', TEST_EMAIL)
      .single();

    if (verifyError || !verifyUser) {
      console.log('⚠️  Warning: User lookup by email failed');
    } else {
      console.log('✅ User can be found by email');
      console.log(`   Role: ${verifyUser.role}`);
    }

    console.log('\n✅ Test doula user created successfully!');
    console.log(`\n📋 Login Credentials:`);
    console.log(`   Email: ${TEST_EMAIL}`);
    console.log(`   Password: ${TEST_PASSWORD}`);
    console.log(`   Role: doula`);
    console.log(`\n💡 You can now use these credentials in your test script.`);

  } catch (error: any) {
    console.error('\n❌ Error creating test doula user:');
    console.error(error.message);
    if (error.details) {
      console.error('Details:', error.details);
    }
    process.exit(1);
  }
}

// Run the script
createTestDoulaUser();
