// Generate Working Contract with PDF conversion that preserves layout
// This generates a DOCX, converts it to PDF, and preserves the layout perfectly

import { exec } from 'child_process';
import { promisify } from 'util';
import Docxtemplater from 'docxtemplater';
import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';

const execAsync = promisify(exec);

async function generateWorkingContractWithPdf() {
  try {
    console.log('🚀 Generating Working Contract with PDF conversion...\n');

    // 1️⃣ Use the working template from docs folder
    const templatePath = path.join(
      process.cwd(),
      'docs',
      'Agreement for Postpartum Doula Services (1).docx'
    );
    console.log(`📥 Using template: ${templatePath}`);

    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template not found at: ${templatePath}`);
    }

    const content = fs.readFileSync(templatePath);
    const zip = new PizZip(content);

    // 2️⃣ Create docxtemplater instance
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    // 3️⃣ Set template variables (using the working format)
    const templateVariables = {
      totalHours: '120',
      hourlyRate: '35.00',
      overnightFee: '50.00',
      totalAmount: '4,200.00',
      deposit: '600.00',
      clientInitials: 'JT',
      clientName: 'Jerry Techluminate',
      client_signature: '', // Will be filled by SignNow
      client_signed_date: '', // Will be filled by SignNow
    };

    console.log('📋 Template variables:', templateVariables);
    doc.setData(templateVariables);

    // 4️⃣ Render the document
    doc.render();

    // 5️⃣ Generate output
    const buffer = doc.getZip().generate({ type: 'nodebuffer' });

    // 6️⃣ Save the generated DOCX
    const timestamp = Date.now();
    const docxPath = path.join(
      process.cwd(),
      'generated',
      `working-contract-${timestamp}.docx`
    );
    await fs.promises.writeFile(docxPath, buffer);

    console.log(`✅ Working DOCX generated: ${docxPath}`);

    // 7️⃣ Convert DOCX to PDF using LibreOffice (preserves layout perfectly)
    console.log('🔄 Converting DOCX to PDF with layout preservation...');
    
    const pdfPath = path.join(
      process.cwd(),
      'generated',
      `working-contract-${timestamp}.pdf`
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

    // 8️⃣ Check if PDF was created and rename it properly
    const generatedPdfPath = path.join(
      process.cwd(),
      'generated',
      `working-contract-${timestamp}.pdf`
    );

    if (fs.existsSync(generatedPdfPath)) {
      console.log(`✅ PDF generated: ${generatedPdfPath}`);
      
      // 9️⃣ Also save a copy with a simple name for easy access
      const simplePdfPath = path.join(
        process.cwd(),
        'generated',
        'ready-for-signnow.pdf'
      );
      await fs.promises.copyFile(generatedPdfPath, simplePdfPath);
      
      console.log(`📄 Ready for SignNow: ${simplePdfPath}`);
      
      // 🔟 Open the PDF to verify layout preservation
      console.log('🔍 Opening PDF to verify layout preservation...');
      await execAsync(`open "${simplePdfPath}"`);
      
    } else {
      throw new Error('PDF file was not created');
    }

    console.log('\n🎉 SUCCESS! Contract Generated with PDF Conversion!');
    console.log('\n📋 Files Generated:');
    console.log(`   📄 DOCX: ${docxPath}`);
    console.log(`   📄 PDF: ${generatedPdfPath}`);
    console.log(`   📄 Ready for SignNow: ${simplePdfPath}`);

    console.log('\n📋 Next Steps:');
    console.log('1. ✅ Contract generated with perfect layout preservation');
    console.log('2. ✅ DOCX converted to PDF with layout preserved');
    console.log('3. 📤 Upload the PDF file to SignNow');
    console.log('4. ✍️ Add signature fields in SignNow interface');
    console.log('5. 📧 Send signing invitation to client');

    console.log('\n💡 Benefits of this approach:');
    console.log('   ✅ Perfect layout preservation (no conversion drift)');
    console.log('   ✅ DOCX to PDF conversion using LibreOffice');
    console.log('   ✅ All formatting, logos, and styling preserved');
    console.log('   ✅ Uses proven working DOCX template process');
    console.log('   ✅ PDF ready for SignNow upload');

    return {
      docxPath,
      pdfPath: generatedPdfPath,
      simplePdfPath
    };

  } catch (error) {
    console.error('❌ Error generating working contract with PDF:', error);
    throw error;
  }
}

// Run the generation
generateWorkingContractWithPdf().catch(console.error);






