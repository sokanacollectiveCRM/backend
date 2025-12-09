/**
 * Test script to verify storage policies are set up correctly
 *
 * Usage: npx tsx scripts/test-storage-policies.ts
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const testEmail = process.env.TEST_DOULA_EMAIL || 'jerry@techluminateacademy.com';
const testPassword = process.env.TEST_DOULA_PASSWORD || '@Bony5690';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const supabaseClient = createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY || '');

async function testStoragePolicies() {
  console.log('🔍 Testing Storage Policies for doula-documents bucket...\n');

  try {
    // Step 1: Login as doula to get auth token
    console.log('📝 Step 1: Logging in as doula...');
    const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    if (authError || !authData.user) {
      console.error('❌ Failed to login:', authError?.message);
      process.exit(1);
    }

    const authUserId = authData.user.id;
    const accessToken = authData.session?.access_token;

    console.log(`✅ Logged in successfully`);
    console.log(`   Auth User ID: ${authUserId}`);
    console.log(`   Email: ${authData.user.email}\n`);

    // Step 2: Get user from users table
    console.log('📝 Step 2: Getting user from users table...');
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email, role')
      .eq('email', testEmail)
      .single();

    if (userError || !userData) {
      console.error('❌ Failed to get user:', userError?.message);
      process.exit(1);
    }

    console.log(`✅ Found user in users table`);
    console.log(`   Users Table ID: ${userData.id}`);
    console.log(`   Role: ${userData.role}\n`);

    // Step 3: Check if IDs match
    if (authUserId !== userData.id) {
      console.log('⚠️  WARNING: Auth User ID and Users Table ID do not match!');
      console.log(`   This will cause storage policy failures.`);
      console.log(`   Auth ID: ${authUserId}`);
      console.log(`   Users ID: ${userData.id}\n`);
    } else {
      console.log('✅ Auth User ID matches Users Table ID\n');
    }

    // Step 4: Check bucket exists
    console.log('📝 Step 3: Checking if bucket exists...');
    const { data: buckets, error: bucketError } = await supabaseAdmin.storage.listBuckets();

    if (bucketError) {
      console.error('❌ Failed to list buckets:', bucketError.message);
      process.exit(1);
    }

    const bucketExists = buckets?.some(b => b.id === 'doula-documents');
    if (!bucketExists) {
      console.error('❌ Bucket "doula-documents" does not exist!');
      console.log('💡 Create it in Supabase Dashboard > Storage\n');
      process.exit(1);
    }

    console.log('✅ Bucket "doula-documents" exists\n');

    // Step 5: Check storage policies
    console.log('📝 Step 4: Checking storage policies...');
    const { data: policies, error: policyError } = await supabaseAdmin
      .from('pg_policies')
      .select('policyname, cmd')
      .eq('schemaname', 'storage')
      .eq('tablename', 'objects')
      .like('policyname', '%doula%');

    if (policyError) {
      console.log('⚠️  Could not query policies (this is okay, policies might exist)');
    } else {
      console.log(`✅ Found ${policies?.length || 0} doula-related policies:`);
      policies?.forEach(p => {
        console.log(`   - ${p.policyname} (${p.cmd})`);
      });
      console.log('');
    }

    // Step 6: Test upload with auth user ID
    console.log('📝 Step 5: Testing upload with auth user ID...');
    const testFilePath = `${authUserId}/test/test-${Date.now()}.txt`;
    const testContent = Buffer.from('Test document content');

    // Create client with user's token
    const userClient = createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY || '', {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });

    const { data: uploadData, error: uploadError } = await userClient.storage
      .from('doula-documents')
      .upload(testFilePath, testContent, {
        contentType: 'text/plain',
      });

    if (uploadError) {
      console.error('❌ Upload failed:', uploadError.message);
      console.log('\n💡 Possible issues:');
      console.log('   1. Storage policies not set up correctly');
      console.log('   2. Auth User ID mismatch');
      console.log('   3. Bucket permissions incorrect');
      console.log('\n📋 Run the SQL migration: src/db/migrations/setup_doula_documents_storage.sql');
      process.exit(1);
    }

    console.log('✅ Upload successful!');
    console.log(`   File path: ${testFilePath}\n`);

    // Step 7: Clean up test file
    console.log('📝 Step 6: Cleaning up test file...');
    const { error: deleteError } = await userClient.storage
      .from('doula-documents')
      .remove([testFilePath]);

    if (deleteError) {
      console.log('⚠️  Could not delete test file:', deleteError.message);
    } else {
      console.log('✅ Test file deleted\n');
    }

    console.log('✅ All tests passed! Storage policies are working correctly.');

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

testStoragePolicies();
