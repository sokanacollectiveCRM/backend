// Summary of Labor Support Contract Upload Success
// This shows what we've accomplished with the SignNow integration

require('dotenv').config();
const SignNowService = require('../src/services/signNowService');
const fs = require('fs');
const path = require('path');

async function uploadLaborSupportSummary() {
  try {
    console.log('🎉 LABOR SUPPORT CONTRACT UPLOAD SUCCESS SUMMARY\n');

    // 1️⃣ Initialize the SignNow service
    const signNowService = new SignNowService();
    console.log('✅ SignNow service initialized');

    // 2️⃣ Test authentication
    console.log('🔐 Testing SignNow authentication...');
    const authResult = await signNowService.testAuthentication();
    console.log('✅ Authentication successful:', authResult.message);

    // 3️⃣ Find the latest Labor Support PDF
    const generatedDir = path.join(process.cwd(), 'generated');
    const files = await fs.promises.readdir(generatedDir);
    
    const laborSupportPdf = files
      .filter(file => file.startsWith('labor-support-final-') && file.endsWith('.pdf'))
      .sort()
      .pop();

    if (!laborSupportPdf) {
      throw new Error('Labor Support PDF not found. Please run the contract generation script first.');
    }

    const pdfPath = path.join(generatedDir, laborSupportPdf);
    console.log(`📄 Using Labor Support PDF: ${pdfPath}`);

    // 4️⃣ Upload the PDF to SignNow
    console.log('📤 Uploading PDF to SignNow...');
    const uploadResult = await signNowService.uploadDocument(pdfPath, 'Labor Support Contract');
    console.log('✅ PDF uploaded successfully');
    console.log('📄 Document ID:', uploadResult.documentId);

    // 5️⃣ Add signature fields
    console.log('✍️ Adding signature fields...');
    const fieldsResult = await signNowService.addStandardContractFields(uploadResult.documentId, {
      signatureX: 450,
      signatureY: 380,
      nameX: 150,
      nameY: 350,
      dateX: 150,
      dateY: 330,
      page: 1
    });
    console.log('✅ Signature fields added successfully');

    console.log('\n🎉 LABOR SUPPORT CONTRACT UPLOADED SUCCESSFULLY!');
    console.log('\n📋 Summary:');
    console.log(`   📄 Document ID: ${uploadResult.documentId}`);
    console.log(`   📄 Document Name: ${uploadResult.name}`);
    console.log(`   ✍️ Signature fields added: ${fieldsResult.fields.length} fields`);
    console.log(`   📧 Ready for signing`);

    console.log('\n💡 Next Steps:');
    console.log('1. ✅ Labor Support contract uploaded to SignNow');
    console.log('2. ✅ Signature fields added to the document');
    console.log('3. 📧 Document is ready for signing');
    console.log('4. 🔗 You can now create signing invitations manually in SignNow');
    console.log('5. 📄 Or use the SignNow web interface to send signing invitations');

    console.log('\n🔗 SignNow Document URL:');
    console.log(`   https://app.signnow.com/webapp/document/${uploadResult.documentId}`);

    return {
      documentId: uploadResult.documentId,
      documentName: uploadResult.name,
      fieldsAdded: fieldsResult.fields.length,
      success: true
    };

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Run the summary
uploadLaborSupportSummary().catch(console.error);





