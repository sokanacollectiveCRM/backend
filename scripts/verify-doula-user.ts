/**
 * Quick script to verify if a doula user exists in the database
 * Usage: npx tsx scripts/verify-doula-user.ts <email>
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const email = process.argv[2] || 'info@techluminateacademy.com';

async function verifyUser() {
  console.log(`\n🔍 Checking for user: ${email}\n`);

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle();

  if (error) {
    console.error('❌ Error querying database:', error);
    return;
  }

  if (!data) {
    console.log('❌ User not found in database');
    console.log('   This means the user record was not created during the invite process.');
    return;
  }

  console.log('✅ User found in database:');
  console.log(`   ID: ${data.id}`);
  console.log(`   Email: ${data.email}`);
  console.log(`   Name: ${data.firstname} ${data.lastname}`);
  console.log(`   Role: ${data.role}`);
  console.log(`   Account Status: ${data.account_status}`);
  console.log(`   Created At: ${data.created_at}`);
  
  if (data.account_status !== 'pending') {
    console.log('\n⚠️  Warning: Account status is not "pending"');
    console.log('   Expected: pending');
    console.log(`   Actual: ${data.account_status}`);
  } else {
    console.log('\n✅ Account status is correct (pending)');
    console.log('   User should be able to sign up now!');
  }
}

verifyUser()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });

