const { signContract } = require('./contractProcessor');

/**
 * Test script for Doula Contract with Signature Picker
 * This demonstrates the complete doula contract signing workflow
 */

async function testDoulaContractWithSignature() {
  try {
    console.log('🤱 Testing Doula Contract with Signature Picker...\n');

    // Test data for doula contract signing
    const testData = {
      contractId: 'doula-contract-002',
      signatureName: 'signature2', // Client selected signature2
      clientName: 'Sarah Johnson',
      signatureDate: '2024-01-15'
    };

    console.log('📋 Test Data:', JSON.stringify(testData, null, 2));
    console.log('\n✍️ Testing doula contract signature application...\n');

    // Test the signature application
    const result = await signContract(
      testData.contractId,
      testData.signatureName,
      testData.clientName,
      testData.signatureDate
    );

    console.log('\n✅ Doula Contract Signature Results:');
    console.log('====================================');
    console.log(`Contract ID: ${result.contractId}`);
    console.log(`Client Name: ${result.clientName}`);
    console.log(`Selected Signature: ${testData.signatureName}`);
    console.log(`Signed PDF Path: ${result.signedPdfPath}`);
    console.log(`Signed URL: ${result.signedUrl}`);
    console.log(`Signature Date: ${result.signatureDate}`);
    console.log(`Success: ${result.success}`);

    console.log('\n🔗 You can access the signed doula contract at the URL above');
    console.log('\n📧 Confirmation email sent to admin');

  } catch (error) {
    console.error('❌ Doula contract signature test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testDoulaContractWithSignature();
}

module.exports = { testDoulaContractWithSignature };
