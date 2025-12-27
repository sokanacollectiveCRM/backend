require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function downloadLaborSupportTemplate() {
  try {
    console.log(
      '🔍 Downloading Labor Support template from Supabase storage...'
    );

    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials in environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Download the Labor Support template
    const templateFileName = 'Labor Support Agreement for Service.docx';
    console.log(`📥 Downloading: ${templateFileName}`);

    const { data: templateBlob, error: downloadError } = await supabase.storage
      .from('contract-templates')
      .download(templateFileName);

    if (downloadError) {
      throw new Error(`Failed to download template: ${downloadError.message}`);
    }

    if (!templateBlob) {
      throw new Error('Template data is null from Supabase Storage');
    }

    // Convert Blob to Buffer and save to file
    const arrayBuffer = await templateBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Save to current directory
    const outputPath = path.join(process.cwd(), templateFileName);
    fs.writeFileSync(outputPath, buffer);

    console.log('✅ Template downloaded successfully!');
    console.log(`📄 Saved to: ${outputPath}`);
    console.log(`📊 File size: ${buffer.length} bytes`);

    return outputPath;
  } catch (error) {
    console.error('❌ Error downloading template:', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

// Run the script
downloadLaborSupportTemplate();






