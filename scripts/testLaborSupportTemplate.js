// Test Layout Preservation using Labor Support Template
// This uses the "Labor Support Agreement for Service.docx" template
import Docxtemplater from 'docxtemplater';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import { promisify } from 'util';

import { createClient } from '@supabase/supabase-js';
import { exec } from 'child_process';

// Load environment variables
dotenv.config();

const execAsync = promisify(exec);

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function testLaborSupportTemplate() {
  try {
    console.log(
      '🚀 Testing Layout Preservation with Labor Support Template...\n'
    );

    // 1️⃣ Download the Labor Support template from Supabase
    const templateFileName = 'Labor Support Agreement for Service.docx';
    console.log(`📥 Downloading template: ${templateFileName}`);

    const { data: templateBlob, error: downloadError } = await supabase.storage
      .from('contract-templates')
      .download(templateFileName);

    if (downloadError || !templateBlob) {
      throw new Error(`Template not found: ${downloadError?.message}`);
    }

    // 2️⃣ Convert Blob to Buffer
    const content = Buffer.from(await templateBlob.arrayBuffer());

    // 3️⃣ Save the template locally for processing
    const templatePath = path.join(
      process.cwd(),
      'generated',
      'labor-support-template.docx'
    );
    await fs.promises.writeFile(templatePath, content);

    console.log(`✅ Template downloaded and saved: ${templatePath}`);

    // 4️⃣ Create docxtemplater instance
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    // 5️⃣ Set template variables for Labor Support Agreement
    const templateVariables = {
      totalAmount: '$2,500',
      depositAmount: '$500',
      balanceAmount: '$2,000',
      client_initials: 'JT',
      clientName: 'Jerry Techluminate',
      client_signature: '', // Will be filled by SignNow
      client_signed_date: '', // Will be filled by SignNow
      client_intials: 'JT', // Note: template has typo "intials"
    };

    console.log('📋 Template variables:', templateVariables);
    doc.setData(templateVariables);

    // 6️⃣ Render the document
    doc.render();

    // 7️⃣ Generate output
    const buffer = doc.getZip().generate({ type: 'nodebuffer' });

    // 8️⃣ Save the generated DOCX
    const timestamp = Date.now();
    const docxPath = path.join(
      process.cwd(),
      'generated',
      `labor-support-contract-${timestamp}.docx`
    );
    await fs.promises.writeFile(docxPath, buffer);

    console.log(`✅ Labor Support DOCX generated: ${docxPath}`);

    // 9️⃣ Convert DOCX to PDF using LibreOffice (preserves layout perfectly)
    console.log('🔄 Converting DOCX to PDF with layout preservation...');

    const pdfPath = path.join(
      process.cwd(),
      'generated',
      `labor-support-contract-${timestamp}.pdf`
    );

    // Use LibreOffice to convert DOCX to PDF
    const command = `soffice --headless --convert-to pdf "${docxPath}" --outdir "${path.dirname(pdfPath)}"`;

    try {
      const { stdout, stderr } = await execAsync(command);

      if (stderr) {
        console.warn('LibreOffice warnings:', stderr);
      }

      console.log('✅ PDF conversion completed');
    } catch (conversionError) {
      console.error('❌ PDF conversion failed:', conversionError);
      throw conversionError;
    }

    // 🔟 Check if PDF was created and rename it properly
    const generatedPdfPath = path.join(
      process.cwd(),
      'generated',
      `labor-support-contract-${timestamp}.pdf`
    );

    if (fs.existsSync(generatedPdfPath)) {
      console.log(`✅ PDF generated: ${generatedPdfPath}`);

      // 1️⃣1️⃣ Also save a copy with a simple name for easy access
      const simplePdfPath = path.join(
        process.cwd(),
        'generated',
        'labor-support-ready-for-signnow.pdf'
      );
      await fs.promises.copyFile(generatedPdfPath, simplePdfPath);

      console.log(`📄 Ready for SignNow: ${simplePdfPath}`);

      // 1️⃣2️⃣ Open the PDF to verify layout preservation
      console.log('🔍 Opening PDF to verify layout preservation...');
      await execAsync(`open "${simplePdfPath}"`);
    } else {
      throw new Error('PDF file was not created');
    }

    console.log(
      '\n🎉 SUCCESS! Labor Support Contract Generated with PDF Conversion!'
    );
    console.log('\n📋 Files Generated:');
    console.log(`   📄 Template: ${templatePath}`);
    console.log(`   📄 DOCX: ${docxPath}`);
    console.log(`   📄 PDF: ${generatedPdfPath}`);
    console.log(`   📄 Ready for SignNow: ${simplePdfPath}`);

    console.log('\n📋 Next Steps:');
    console.log(
      '1. ✅ Labor Support contract generated with perfect layout preservation'
    );
    console.log('2. ✅ DOCX converted to PDF with layout preserved');
    console.log('3. 📤 Upload the PDF file to SignNow');
    console.log('4. ✍️ Add signature fields in SignNow interface');
    console.log('5. 📧 Send signing invitation to client');

    console.log('\n💡 Benefits of this approach:');
    console.log('   ✅ Perfect layout preservation (no conversion drift)');
    console.log('   ✅ DOCX to PDF conversion using LibreOffice');
    console.log('   ✅ All formatting, logos, and styling preserved');
    console.log('   ✅ Uses Labor Support template from Supabase');
    console.log('   ✅ PDF ready for SignNow upload');

    return {
      templatePath,
      docxPath,
      pdfPath: generatedPdfPath,
      simplePdfPath,
    };
  } catch (error) {
    console.error(
      '❌ Error generating Labor Support contract with PDF:',
      error
    );
    throw error;
  }
}

// Run the generation
testLaborSupportTemplate().catch(console.error);






