const { generateContractDocx } = require('../src/utils/contractProcessor');

async function testTemplateSelection() {
  console.log('🔍 Testing Template Selection Only (NO SIGNNOW)');
  console.log('================================================');

  const contractData = {
    clientName: 'Jerry Techluminate',
    clientEmail: 'jerry@techluminateacademy.com',
    totalInvestment: '$2,500',
    depositAmount: '$500',
    remainingBalance: '$2,000',
    serviceType: 'Labor Support Services', // This should trigger Labor Support template
    contractDate: '10/2/2025',
    dueDate: '2025-11-01',
    startDate: '2025-10-02',
    endDate: '2025-12-31'
  };

  console.log('📝 Contract Data:');
  console.log(`   Service Type: ${contractData.serviceType}`);
  console.log('');

  try {
    console.log('🔄 Generating DOCX only (no SignNow)...');
    const contractId = 'test-template-' + Date.now();
    const docxPath = await generateContractDocx(contractData, contractId);

    console.log('✅ DOCX generated successfully!');
    console.log(`📄 File: ${docxPath}`);
    console.log('');
    console.log('🔍 Check the generated DOCX file to verify:');
    console.log('   1. Template used: Labor Support Agreement for Service.docx');
    console.log('   2. Variables substituted: totalAmount, depositAmount, balanceAmount');
    console.log('   3. No SignNow invitation sent');

  } catch (error) {
    console.log('❌ DOCX generation failed');
    console.log('📊 Error:', error.message);
  }
}

testTemplateSelection();
