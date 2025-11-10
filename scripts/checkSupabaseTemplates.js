require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function checkSupabaseTemplates() {
  try {
    console.log('🔍 Checking available templates in Supabase Storage...');

    // Initialize Supabase client
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // List all files in contract-templates bucket
    const { data: files, error } = await supabase.storage
      .from('contract-templates')
      .list();

    if (error) {
      console.error('❌ Error listing templates:', error);
      return;
    }

    console.log('📋 Available templates in Supabase Storage:');
    console.log('=============================================');

    if (files && files.length > 0) {
      files.forEach((file, index) => {
        console.log(`${index + 1}. ${file.name}`);
        console.log(`   Size: ${file.metadata?.size || 'Unknown'} bytes`);
        console.log(`   Updated: ${file.updated_at}`);
        console.log('');
      });
    } else {
      console.log('❌ No templates found in Supabase Storage');
    }

    // Check if Labor Support template exists
    const laborSupportTemplate = files?.find(
      (file) =>
        file.name.toLowerCase().includes('labor support') ||
        file.name.toLowerCase().includes('labor')
    );

    if (laborSupportTemplate) {
      console.log(
        '✅ Labor Support template found:',
        laborSupportTemplate.name
      );
    } else {
      console.log('❌ Labor Support template not found in Supabase Storage');
      console.log(
        '💡 You may need to upload the Labor Support template to Supabase Storage'
      );
    }
  } catch (error) {
    console.error('❌ Error checking Supabase templates:', error);
  }
}

// Run the script
checkSupabaseTemplates();





