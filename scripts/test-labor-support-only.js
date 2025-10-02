const axios = require('axios');

async function testLaborSupportContract() {
  console.log('🤱 Testing Labor Support Contract Generation');
  console.log('================================================================');

  const contractData = {
    clientName: 'Jerry Techluminate',
    clientEmail: 'jerry@techluminateacademy.com',
    totalInvestment: '$2,500',
    depositAmount: '$300',
    remainingBalance: '$2,200',
    serviceType: 'Labor Support Services', // This is the key difference
    contractDate: '10/2/2025',
    dueDate: '2025-11-01',
    startDate: '2025-10-02',
    endDate: '2025-12-31'
  };

  console.log('📝 Labor Support Contract Data:');
  console.log(`   Client: ${contractData.clientName}`);
  console.log(`   Email: ${contractData.clientEmail}`);
  console.log(`   Total Investment: ${contractData.totalInvestment}`);
  console.log(`   Deposit Amount: ${contractData.depositAmount}`);
  console.log(`   Service Type: ${contractData.serviceType}`);
  console.log('');

  try {
    console.log('🔄 Generating Labor Support contract...');
    const response = await axios.post('http://localhost:5050/api/contract-signing/generate-contract', contractData);

    console.log('✅ Labor Support contract generation successful!');
    console.log('📊 Response:', JSON.stringify(response.data, null, 2));

    if (response.data.success) {
      console.log('');
      console.log('📄 Generated Files:');
      console.log(`   DOCX: ${response.data.data.docxPath}`);
      console.log(`   PDF: ${response.data.data.pdfPath}`);
      console.log(`   SignNow Document ID: ${response.data.data.signNow.documentId}`);
      console.log('');
      console.log('📧 SignNow invitation sent to:', response.data.data.clientEmail);
      console.log('🔍 Check the SignNow document to verify Labor Support field positioning');
    }

  } catch (error) {
    console.log('❌ Labor Support contract generation failed');
    console.log('📊 Error:', error.response?.data?.message || error.message);
    console.log('📊 Full Error:', error.response?.data || error.message);
  }
}

testLaborSupportContract();
