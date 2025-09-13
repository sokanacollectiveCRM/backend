const { processAndUploadContract } = require('./contractProcessor');

/**
 * Test script for the Doula Contract
 * This demonstrates how to use the contractProcessor with doula service data
 */

async function testDoulaContract() {
  try {
    console.log('🤱 Starting Doula Contract Test...\n');

    // Sample doula contract data
    const doulaContractData = {
      contractId: 'doula-contract-001',
      clientName: 'Sarah Johnson',
      partnerName: 'Michael Johnson',
      dueDate: '2024-03-15',
      clientPhone: '(555) 123-4567',
      clientEmail: 'jerry@techluminateacademy.com',
      servicePackage: 'Complete Labor Support Package',
      price: '$1,200.00',
      paymentTerms: '50% deposit, balance due 2 weeks before due date',

      // Service details
      prenatalVisits: '3 prenatal visits',
      postpartumVisits: '2 postpartum visits',
      availabilityStart: '2 weeks before due date',
      availabilityEnd: '2 weeks after birth',

      // Payment breakdown
      depositAmount: '$600.00',
      remainingBalance: '$600.00',
      finalPaymentDate: '2024-03-01',
      paymentMethods: 'Cash, Check, Credit Card, or Bank Transfer',

      // Cancellation policies
      cancellationPolicy30: 'Full refund minus $100 administrative fee',
      cancellationPolicy15: '50% refund of remaining balance',
      cancellationPolicy7: 'No refund available',

      // Emergency protocols
      responseTime: '15',

      // Contract dates
      startDate: '2024-02-15',
      endDate: '2024-04-15',

      // Provider details (these would be filled by the system)
      providerName: 'Sokana Collective',
      providerAddress: '123 Birth Support Lane, Anytown, ST 12345',
      providerPhone: '(555) 987-6543',
      providerEmail: 'info@sokanacollective.com',

      // Current date
      date: new Date().toLocaleDateString()
    };

    console.log('📋 Doula Contract Data:', JSON.stringify(doulaContractData, null, 2));
    console.log('\n📝 Processing doula contract...\n');

    // Process the contract
    const result = await processAndUploadContract(doulaContractData);

    console.log('\n✅ Doula Contract Processing Results:');
    console.log('=====================================');
    console.log(`Contract ID: ${result.contractId}`);
    console.log(`Client: ${doulaContractData.clientName}`);
    console.log(`Service Package: ${doulaContractData.servicePackage}`);
    console.log(`Total Investment: ${doulaContractData.price}`);
    console.log(`Due Date: ${doulaContractData.dueDate}`);
    console.log(`DOCX Path: ${result.docxPath}`);
    console.log(`PDF Path: ${result.pdfPath}`);
    console.log(`Signed PDF Path: ${result.signedPdfPath}`);
    console.log(`Signed URL: ${result.signedUrl}`);
    console.log(`Email Sent: ${result.emailSent}`);
    console.log(`Success: ${result.success}`);

    console.log('\n🔗 You can access the doula contract at the URL above (valid for 1 hour)');
    console.log('\n📧 The doula contract has been sent to:', doulaContractData.clientEmail);

    // Optional: Clean up generated files after some time
    // Uncomment the following lines if you want to clean up files
    // console.log('\n🧹 Cleaning up generated files...');
    // await cleanupGeneratedFiles(doulaContractData.contractId);
    // console.log('✅ Cleanup completed');

  } catch (error) {
    console.error('❌ Doula contract test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testDoulaContract();
}

module.exports = { testDoulaContract };
