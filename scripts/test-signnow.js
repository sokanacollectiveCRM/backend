const SignNowService = require('../src/services/signNowService');
const fs = require('fs-extra');
const path = require('path');

// Set up SignNow environment variables
process.env.SIGNNOW_ENV = 'eval';
process.env.SIGNNOW_BASE_URL = 'https://api.signnow.com';
process.env.SIGNNOW_CLIENT_ID = '323e680065f1cbee4fe1e97664407a0b';
process.env.SIGNNOW_CLIENT_SECRET = '5b2cbddac384f40fa1043ed19b34c61a';
process.env.SIGNNOW_USERNAME = 'jerry@techluminateacademy.com';
process.env.SIGNNOW_PASSWORD = '@Bony5690';
process.env.SIGNNOW_BASIC_AUTH_TOKEN = 'MzIzZTY4MDA2NWYxY2JlZTRmZTFlOTc2NjQ0MDdhMGI6NWIyY2JkZGFjMzg0ZjQwZmExMDQzZWQxOWIzNGM2MWE=';

async function testSignNowIntegration() {
  try {
    console.log('🔄 Starting SignNow Integration Test...\n');

    // Initialize service
    const signNowService = new SignNowService();

    // 1. Test Authentication
    console.log('1️⃣ Testing Authentication...');
    const authResult = await signNowService.testAuthentication();
    console.log('✅ Authentication successful:', authResult);

    // 2. Test Document Upload
    console.log('\n2️⃣ Testing Document Upload...');
    const testContractPath = path.join(__dirname, '../templates/test-contract.txt');
    const uploadResult = await signNowService.uploadDocument(
      testContractPath,
      'Test Contract'
    );
    console.log('✅ Document uploaded:', uploadResult);

    // Store documentId for next steps
    const { documentId } = uploadResult;

    // 3. Test Adding Fields
    console.log('\n3️⃣ Testing Adding Standard Fields...');
    const fieldsResult = await signNowService.addStandardContractFields(documentId);
    console.log('✅ Fields added:', fieldsResult);

    // 4. Test Creating Invitation
    console.log('\n4️⃣ Testing Creating Invitation...');
    const inviteResult = await signNowService.createSigningInvitation(
      documentId,
      'test@example.com',
      'Test User',
      'test-contract-001'
    );
    console.log('✅ Invitation created:', inviteResult);

    // 5. Test Getting Document Status
    console.log('\n5️⃣ Testing Document Status...');
    const statusResult = await signNowService.getInvitationStatus(documentId);
    console.log('✅ Document status:', statusResult);

    console.log('\n🎉 All tests completed successfully!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response?.data) {
      console.error('API Error Details:', error.response.data);
    }
  }
}

// Run the test
testSignNowIntegration();
