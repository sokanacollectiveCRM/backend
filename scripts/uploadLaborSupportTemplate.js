require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function uploadLaborSupportTemplate() {
  try {
    console.log('🔍 Uploading Labor Support template to Supabase Storage...');

    // Initialize Supabase client
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // Check if Labor Support template exists locally
    const templatePath = path.join(
      process.cwd(),
      'templates/Labor Support Agreement for Service.docx'
    );

    if (!fs.existsSync(templatePath)) {
      console.log(
        '❌ Labor Support template not found locally at:',
        templatePath
      );
      console.log(
        '💡 Please ensure the template file exists in the docs folder'
      );
      return;
    }

    console.log('📄 Found Labor Support template locally:', templatePath);

    // Read the template file
    const templateBuffer = fs.readFileSync(templatePath);
    console.log(`📄 Template size: ${templateBuffer.length} bytes`);

    // Upload to Supabase Storage
    console.log('⬆️ Uploading template to Supabase Storage...');

    const { data, error } = await supabase.storage
      .from('contract-templates')
      .upload('Labor Support Agreement for Service.docx', templateBuffer, {
        contentType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        upsert: true, // Overwrite if exists
      });

    if (error) {
      console.error('❌ Error uploading template:', error);
      return;
    }

    console.log('✅ Labor Support template uploaded successfully!');
    console.log('📋 Upload details:', data);

    // Verify the upload
    console.log('🔍 Verifying upload...');
    const { data: files, error: listError } = await supabase.storage
      .from('contract-templates')
      .list();

    if (listError) {
      console.error('❌ Error listing files after upload:', listError);
      return;
    }

    console.log('📋 Templates now available in Supabase Storage:');
    files?.forEach((file, index) => {
      console.log(`${index + 1}. ${file.name}`);
    });
  } catch (error) {
    console.error('❌ Error uploading Labor Support template:', error);
  }
}

// Run the script
uploadLaborSupportTemplate();
