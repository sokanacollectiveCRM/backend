// Download PDF for coordinate picker
// This script downloads the PDF template so you can use it with the coordinate picker
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function downloadPdfForPicker() {
  try {
    console.log('📥 Downloading PDF template for coordinate picker...');

    // Download the Labor Support Agreement template
    const templateName = 'Labor Support Agreement for Service.docx.pdf';

    const { data: file, error } = await supabase.storage
      .from('contract-templates')
      .download(templateName);

    if (error || !file) {
      throw new Error(`Template not found: ${error?.message}`);
    }

    // Save to tools directory for easy access
    const outputPath = path.join(process.cwd(), 'tools', templateName);
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    await fs.promises.writeFile(outputPath, fileBuffer);

    console.log('✅ PDF downloaded successfully!');
    console.log(`📄 File saved to: ${outputPath}`);
    console.log('');
    console.log('🎯 Next Steps:');
    console.log('1. Open the coordinate picker in your browser');
    console.log('2. Upload the downloaded PDF file');
    console.log('3. Start mapping coordinates by clicking on the PDF');
    console.log('');
    console.log('📋 Available fields to map:');
    console.log('  - clientName');
    console.log('  - totalAmount');
    console.log('  - deposit');
    console.log('  - balanceAmount');
    console.log('  - clientInitials');
    console.log('  - client_signature');
    console.log('  - client_signed_date');
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Run the download
downloadPdfForPicker().catch(console.error);






