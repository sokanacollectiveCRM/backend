// Upload Labor Support Contract using embedded invite method
// This bypasses the role issue by using the embedded invite method

require('dotenv').config();
const SignNowService = require('../src/services/signNowService');
const fs = require('fs');
const path = require('path');

async function uploadLaborSupportEmbedded() {
  try {
    console.log('🚀 UPLOADING LABOR SUPPORT CONTRACT - EMBEDDED INVITE METHOD\n');

    // 1️⃣ Initialize the SignNow service
    const signNowService = new SignNowService();
    console.log('✅ SignNow service initialized');

    // 2️⃣ Test authentication first
    console.log('🔐 Testing SignNow authentication...');
    try {
      const authResult = await signNowService.testAuthentication();
      console.log('✅ Authentication successful:', authResult.message);
    } catch (authError) {
      console.error('❌ Authentication failed:', authError.message);
      throw authError;
    }

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

    // 6️⃣ Create embedded signing link
    console.log('📧 Creating embedded signing link...');
    const embeddedResult = await signNowService.createEmbeddedInviteLink(
      uploadResult.documentId,
      { email: 'jerrybony5@gmail.com', name: 'Jerry Techluminate' },
      { 
        roleName: 'Signer 1',
        expiresIn: 60, // 60 minutes
        auth_method: 'email'
      }
    );
    console.log('✅ Embedded signing link created successfully');

    console.log('\n🎉 LABOR SUPPORT CONTRACT UPLOADED SUCCESSFULLY!');
    console.log('\n📋 Summary:');
    console.log(`   📄 Document ID: ${uploadResult.documentId}`);
    console.log(`   🔗 Signing Link: ${embeddedResult.link}`);
    console.log(`   📧 Invitation ID: ${embeddedResult.inviteId}`);
    console.log(`   📧 Signing link for: jerrybony5@gmail.com`);
    console.log(`   ✍️ Signature fields added`);

    console.log('\n💡 Next Steps:');
    console.log('1. ✅ Labor Support contract uploaded to SignNow');
    console.log('2. 🔗 Use the signing link to sign the contract');
    console.log('3. ✍️ Sign the contract using the embedded link');
    console.log('4. 📄 Download the signed contract');

    return {
      documentId: uploadResult.documentId,
      signingLink: embeddedResult.link,
      invitationId: embeddedResult.inviteId,
      success: true
    };

  } catch (error) {
    console.error('❌ Error uploading Labor Support contract:', error);
    throw error;
  }
}

// Run the upload
uploadLaborSupportEmbedded().catch(console.error);





