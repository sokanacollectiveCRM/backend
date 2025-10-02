const axios = require('axios');

async function testLaborSupportContractNoInvite() {
  console.log('🤱 Testing Labor Support Contract Generation (NO INVITE)');
  console.log('================================================================');

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
    endDate: '2025-12-31',
    skipSignNow: true // Add flag to skip SignNow invitation
  };

  console.log('📝 Labor Support Contract Data:');
  console.log(`   Client: ${contractData.clientName}`);
  console.log(`   Email: ${contractData.clientEmail}`);
  console.log(`   Total Investment: ${contractData.totalInvestment}`);
  console.log(`   Deposit Amount: ${contractData.depositAmount}`);
  console.log(`   Service Type: ${contractData.serviceType}`);
  console.log(`   Skip SignNow: ${contractData.skipSignNow}`);
  console.log('');

  try {
    console.log('🔄 Generating Labor Support contract (template only)...');
    const response = await axios.post('http://localhost:5050/api/contract-signing/generate-contract', contractData);

    console.log('✅ Labor Support contract generation successful!');
    console.log('📊 Response:', JSON.stringify(response.data, null, 2));

    if (response.data.success) {
      console.log('');
      console.log('📄 Generated Files:');
      console.log(`   DOCX: ${response.data.data.docxPath}`);
      console.log(`   PDF: ${response.data.data.pdfPath}`);
      console.log('');
      console.log('🔍 Check the generated PDF to verify:');
      console.log('   1. Template used: Labor Support Agreement for Service.docx');
      console.log('   2. Variables substituted: totalAmount, depositAmount, balanceAmount');
      console.log('   3. No SignNow invitation sent');
    }

  } catch (error) {
    console.log('❌ Labor Support contract generation failed');
    console.log('📊 Error:', error.response?.data?.message || error.message);
    console.log('📊 Full Error:', error.response?.data || error.message);
  }
}

testLaborSupportContractNoInvite();
