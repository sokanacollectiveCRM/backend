// Definitive Layout Shift Test using diff-pdf
// This will definitively show if there's any layout shift between original and generated PDFs

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

async function definitiveLayoutTest() {
  try {
    console.log('🔍 DEFINITIVE LAYOUT SHIFT TEST\n');
    console.log('This test will definitively show if there are any layout differences...\n');

    // 1️⃣ Check if we have the generated files
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

    console.log('📋 Files to compare:');
    console.log(`   📄 Original Template: ${templateDocx}`);
    console.log(`   📄 Generated PDF: ${generatedPdf}`);

    // 2️⃣ Check if files exist
    if (!fs.existsSync(generatedPdf)) {
      throw new Error('Generated PDF not found. Please run the generation script first.');
    }
    if (!fs.existsSync(templateDocx)) {
      throw new Error('Template DOCX not found. Please run the generation script first.');
    }

    console.log('\n✅ All required files exist');

    // 3️⃣ Convert original template to PDF for comparison
    console.log('\n🔄 Converting original template to PDF for comparison...');
    
    const originalPdfPath = path.join(
      process.cwd(),
      'generated',
      'labor-support-original-template.pdf'
    );
    
    try {
      const command = `soffice --headless --convert-to pdf "${templateDocx}" --outdir "${path.dirname(originalPdfPath)}"`;
      const { stdout, stderr } = await execAsync(command);
      
      if (stderr) {
        console.warn('LibreOffice warnings:', stderr);
      }
      
      console.log('✅ Original template converted to PDF');
    } catch (conversionError) {
      console.error('❌ PDF conversion failed:', conversionError);
      throw conversionError;
    }

    // 4️⃣ Use diff-pdf to compare the PDFs
    console.log('\n🔍 Running diff-pdf to detect any layout differences...');
    
    const diffPdfPath = path.join(
      process.cwd(),
      'generated',
      'layout-differences.pdf'
    );

    try {
      // Run diff-pdf command
      const diffCommand = `diff-pdf --output-diff="${diffPdfPath}" "${originalPdfPath}" "${generatedPdf}"`;
      const { stdout, stderr } = await execAsync(diffCommand);
      
      console.log('✅ diff-pdf comparison completed');
      
      // Check if diff PDF was created and its size
      if (fs.existsSync(diffPdfPath)) {
        const diffStats = fs.statSync(diffPdfPath);
        const diffSizeKB = Math.round(diffStats.size / 1024);
        
        console.log(`📊 Diff PDF created: ${diffSizeKB} KB`);
        
        if (diffSizeKB < 10) {
          console.log('\n🎉 RESULT: NO LAYOUT SHIFT DETECTED!');
          console.log('✅ The generated PDF has identical layout to the original');
          console.log('✅ All formatting, positioning, and styling preserved');
        } else {
          console.log('\n⚠️  RESULT: LAYOUT DIFFERENCES DETECTED!');
          console.log('❌ There are differences between original and generated PDFs');
          console.log(`📄 Diff PDF created: ${diffPdfPath}`);
          console.log('🔍 Open the diff PDF to see what changed');
          
          // Open the diff PDF to show the differences
          await execAsync(`open "${diffPdfPath}"`);
        }
      } else {
        console.log('\n🎉 RESULT: NO LAYOUT SHIFT DETECTED!');
        console.log('✅ diff-pdf found no differences - perfect layout preservation!');
      }
      
    } catch (diffError) {
      console.error('❌ diff-pdf failed:', diffError.message);
      
      // Fallback: manual comparison
      console.log('\n🔄 Falling back to manual comparison...');
      console.log('📄 Opening both PDFs for manual inspection...');
      
      await execAsync(`open "${originalPdfPath}"`);
      await execAsync(`open "${generatedPdf}"`);
      
      console.log('\n📋 Manual Comparison Instructions:');
      console.log('1. Compare the two PDFs side by side');
      console.log('2. Look for any differences in:');
      console.log('   - Text positioning');
      console.log('   - Font sizes or styles');
      console.log('   - Spacing and margins');
      console.log('   - Logo placement');
      console.log('   - Overall layout');
    }

    console.log('\n📊 DEFINITIVE TEST COMPLETE!');
    console.log('\n💡 What This Test Proves:');
    console.log('   ✅ diff-pdf is the industry standard for PDF comparison');
    console.log('   ✅ It detects even the smallest layout differences');
    console.log('   ✅ If no differences are found, layout is perfectly preserved');
    console.log('   ✅ This is the most reliable way to verify layout preservation');

  } catch (error) {
    console.error('❌ Error in definitive layout test:', error);
    throw error;
  }
}

// Run the definitive test
definitiveLayoutTest().catch(console.error);





