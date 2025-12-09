/**
 * Script to set up the doula-documents storage bucket in Supabase
 * Run this once to create the bucket and set up RLS policies
 * 
 * Usage: npx tsx scripts/setup-doula-storage.ts
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

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function setupStorage() {
  console.log('🚀 Setting up doula-documents storage bucket...\n');

  try {
    // Check if bucket exists
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
    
    if (listError) {
      throw new Error(`Failed to list buckets: ${listError.message}`);
    }

    const bucketExists = buckets?.some(b => b.id === 'doula-documents');

    if (bucketExists) {
      console.log('✅ Bucket "doula-documents" already exists');
    } else {
      console.log('📦 Creating bucket "doula-documents"...');
      
      // Create bucket
      const { data: bucket, error: createError } = await supabaseAdmin.storage.createBucket('doula-documents', {
        public: false, // Private bucket
        fileSizeLimit: 10485760, // 10MB
        allowedMimeTypes: [
          'application/pdf',
          'image/jpeg',
          'image/png',
          'image/jpg',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ]
      });

      if (createError) {
        // If bucket creation fails, it might already exist or need manual creation
        console.log(`⚠️  Could not create bucket automatically: ${createError.message}`);
        console.log('💡 Please create the bucket manually in Supabase Dashboard:');
        console.log('   1. Go to Storage > New bucket');
        console.log('   2. Name: doula-documents');
        console.log('   3. Public: No');
        console.log('   4. File size limit: 10MB');
        console.log('   5. Allowed MIME types: pdf, jpeg, png, jpg, doc, docx');
      } else {
        console.log('✅ Bucket created successfully');
      }
    }

    console.log('\n📋 Storage bucket setup complete!');
    console.log('💡 Note: RLS policies should be set up via SQL migration:');
    console.log('   Run: src/db/migrations/setup_doula_documents_storage.sql in Supabase SQL Editor');

  } catch (error: any) {
    console.error('\n❌ Error setting up storage:');
    console.error(error.message);
    process.exit(1);
  }
}

setupStorage();

