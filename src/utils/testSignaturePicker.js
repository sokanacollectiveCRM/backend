const { signContract } = require('./contractProcessor');

/**
 * Test script for the Signature Picker
 * This demonstrates how to use the signature selection feature
 */

async function testSignaturePicker() {
  try {
    console.log('🎯 Testing Signature Picker...\n');

    // Test data
    const testData = {
      contractId: 'test-contract-003',
      signatureName: 'signature1', // User selected signature1
      clientName: 'Jerry Bony',
      signatureDate: '2024-01-15'
    };

    console.log('📋 Test Data:', JSON.stringify(testData, null, 2));
    console.log('\n✍️ Testing signature application...\n');

    // Test the signature application
    const result = await signContract(
      testData.contractId,
      testData.signatureName,
      testData.clientName,
      testData.signatureDate
    );

    console.log('\n✅ Signature Application Results:');
    console.log('================================');
    console.log(`Contract ID: ${result.contractId}`);
    console.log(`Signed PDF Path: ${result.signedPdfPath}`);
    console.log(`Signed URL: ${result.signedUrl}`);
    console.log(`Client Name: ${result.clientName}`);
    console.log(`Signature Date: ${result.signatureDate}`);
    console.log(`Success: ${result.success}`);

    console.log('\n🔗 You can access the signed contract at the URL above');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testSignaturePicker();
}

module.exports = { testSignaturePicker };
