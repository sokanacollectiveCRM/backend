// Generate Working Contract using the proven DOCX process
// This generates a perfectly formatted DOCX that can be manually uploaded to SignNow
import Docxtemplater from 'docxtemplater';
import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';

async function generateWorkingContract() {
  try {
    console.log(
      '🚀 Generating Working Contract using the proven DOCX process...\n'
    );

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
    const outputPath = path.join(
      process.cwd(),
      'generated',
      `working-contract-${Date.now()}.docx`
    );
    await fs.promises.writeFile(outputPath, buffer);

    console.log(`✅ Working DOCX generated: ${outputPath}`);

    // 7️⃣ Also save a copy with a simple name for easy access
    const simplePath = path.join(
      process.cwd(),
      'generated',
      'ready-for-signnow.docx'
    );
    await fs.promises.writeFile(simplePath, buffer);

    console.log(`📄 Ready for SignNow: ${simplePath}`);

    console.log('\n🎉 SUCCESS! Contract Generated Successfully!');
    console.log('\n📋 Next Steps:');
    console.log('1. ✅ Contract generated with perfect layout preservation');
    console.log('2. 📤 Upload the DOCX file to SignNow manually');
    console.log('3. ✍️ Add signature fields in SignNow interface');
    console.log('4. 📧 Send signing invitation to client');

    console.log('\n💡 Benefits of this approach:');
    console.log('   ✅ Perfect layout preservation (no conversion drift)');
    console.log('   ✅ No coordinate guessing needed');
    console.log('   ✅ All formatting, logos, and styling preserved');
    console.log('   ✅ Uses proven working DOCX template process');
    console.log('   ✅ Simple manual upload to SignNow');

    return outputPath;
  } catch (error) {
    console.error('❌ Error generating working contract:', error);
    throw error;
  }
}

// Run the generation
generateWorkingContract().catch(console.error);






