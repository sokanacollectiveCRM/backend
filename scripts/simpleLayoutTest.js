// Simple Layout Test - Compare Original vs Generated
// This will show you exactly what changed between the original template and generated PDF

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

async function simpleLayoutTest() {
  try {
    console.log('🔍 SIMPLE LAYOUT TEST - Original vs Generated\n');

    // 1️⃣ Check what files we have
    const generatedPdf = path.join(
      process.cwd(),
      'generated',
      'labor-support-ready-for-signnow.pdf'
    );
    const templateDocx = path.join(
      process.cwd(),
      'generated',
      'labor-support-template.docx'
    );

    console.log('📋 Available files:');
    console.log(`   📄 Template DOCX: ${templateDocx}`);
    console.log(`   📄 Generated PDF: ${generatedPdf}`);

    // 2️⃣ Check if files exist
    const filesExist = {
      template: fs.existsSync(templateDocx),
      generatedPdf: fs.existsSync(generatedPdf)
    };

    console.log('\n📊 File Status:');
    console.log(`   ✅ Template DOCX: ${filesExist.template ? 'EXISTS' : 'NOT FOUND'}`);
    console.log(`   ✅ Generated PDF: ${filesExist.generatedPdf ? 'EXISTS' : 'NOT FOUND'}`);

    if (!filesExist.template || !filesExist.generatedPdf) {
      throw new Error('Required files not found. Please run the generation script first.');
    }

    // 3️⃣ Convert template to PDF for comparison
    console.log('\n🔄 Converting template to PDF for comparison...');
    
    const originalPdfPath = path.join(
      process.cwd(),
      'generated',
      'original-template.pdf'
    );
    
    try {
      const command = `soffice --headless --convert-to pdf "${templateDocx}" --outdir "${path.dirname(originalPdfPath)}"`;
      await execAsync(command);
      console.log('✅ Template converted to PDF');
    } catch (conversionError) {
      console.error('❌ PDF conversion failed:', conversionError);
      throw conversionError;
    }

    // 4️⃣ Open both PDFs for side-by-side comparison
    console.log('\n🔍 Opening PDFs for side-by-side comparison...');
    
    // Open the original template PDF
    await execAsync(`open "${originalPdfPath}"`);
    
    // Wait a moment, then open the generated PDF
    setTimeout(async () => {
      await execAsync(`open "${generatedPdf}"`);
    }, 1000);

    console.log('\n📋 MANUAL COMPARISON INSTRUCTIONS:');
    console.log('You now have both PDFs open. Compare them side-by-side:');
    console.log('');
    console.log('🔍 WHAT TO LOOK FOR:');
    console.log('1. 📄 Text positioning - are the values in the same spots?');
    console.log('2. 📄 Font sizes - are they identical?');
    console.log('3. 📄 Spacing - is the line spacing the same?');
    console.log('4. 📄 Margins - are the margins identical?');
    console.log('5. 📄 Logo placement - is the logo in the same position?');
    console.log('6. 📄 Overall layout - does everything look identical?');
    console.log('');
    console.log('✅ If everything looks identical, there is NO layout shift');
    console.log('❌ If you see any differences, there IS a layout shift');
    console.log('');
    console.log('💡 This is the most reliable way to verify layout preservation!');

  } catch (error) {
    console.error('❌ Error in simple layout test:', error);
    throw error;
  }
}

// Run the simple test
simpleLayoutTest().catch(console.error);






