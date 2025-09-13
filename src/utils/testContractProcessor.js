const { processAndUploadContract, cleanupGeneratedFiles } = require('./contractProcessor');

/**
 * Test script for the Contract Processor
 * This demonstrates how to use the contractProcessor module
 */

async function testContractProcessor() {
  try {
    console.log('🚀 Starting Contract Processor Test...\n');

    // Sample contract data
    const contractData = {
      contractId: 'test-contract-002',
      clientName: 'John Doe',
      serviceName: 'Web Development Services',
      price: '$5,000.00',
      date: new Date().toLocaleDateString(),
      clientEmail: 'jerry@techluminateacademy.com', // Client email for testing
      // Additional custom fields
      projectDescription: 'E-commerce website development',
      startDate: '2024-01-15',
      endDate: '2024-03-15',
      terms: 'Net 30 days'
    };

    console.log('📋 Contract Data:', JSON.stringify(contractData, null, 2));
    console.log('\n📝 Processing contract...\n');

    // Process the contract
    const result = await processAndUploadContract(contractData);

    console.log('\n✅ Contract Processing Results:');
    console.log('================================');
    console.log(`Contract ID: ${result.contractId}`);
    console.log(`DOCX Path: ${result.docxPath}`);
    console.log(`PDF Path: ${result.pdfPath}`);
    console.log(`Signed PDF Path: ${result.signedPdfPath}`);
    console.log(`Signed URL: ${result.signedUrl}`);
    console.log(`Email Sent: ${result.emailSent}`);
    console.log(`Success: ${result.success}`);

    console.log('\n🔗 You can access the signed contract at the URL above (valid for 1 hour)');

    // Optional: Clean up generated files after some time
    // Uncomment the following lines if you want to clean up files
    // console.log('\n🧹 Cleaning up generated files...');
    // await cleanupGeneratedFiles(contractData.contractId);
    // console.log('✅ Cleanup completed');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testContractProcessor();
}

module.exports = { testContractProcessor };
