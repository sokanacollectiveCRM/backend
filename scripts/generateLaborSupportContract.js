require('dotenv').config();
const axios = require('axios');

async function generateLaborSupportContract() {
  try {
    console.log(
      '🔍 Generating Labor Support contract using the API endpoint...'
    );

    // Contract data for Labor Support Agreement
    const contractData = {
      contractId: `labor-support-${Date.now()}`,
      clientName: 'Jane Smith',
      clientEmail: 'jane.smith@example.com',
      serviceType: 'Labor Support Doula Services',
      totalInvestment: '$2,500.00',
      depositAmount: '$500.00',
      remainingBalance: '$2,000.00',
      contractDate: new Date().toLocaleDateString(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0],
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0],

      // Labor Support specific fields
      totalHours: '40',
      hourlyRate: '50.00',
      overnightFee: '0.00',

      // Use the perfect coordinates we extracted
      fieldCoordinates: {
        signature: { x: 380, y: 220, width: 150, height: 35, page: 2 },
        date: { x: 100, y: 275, width: 150, height: 25, page: 2 },
      },
    };

    console.log('📋 Contract data prepared:');
    console.log(JSON.stringify(contractData, null, 2));

    // Call the contract generation endpoint
    console.log('🚀 Calling contract generation endpoint...');

    const response = await axios.post(
      'http://localhost:5050/api/contract-signing/generate-contract',
      contractData,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Contract generation response:');
    console.log(JSON.stringify(response.data, null, 2));

    if (response.data.success) {
      console.log('\n🎉 Labor Support contract generated successfully!');
      console.log(`📧 Contract sent to: ${contractData.clientEmail}`);
      console.log(`📄 Contract ID: ${contractData.contractId}`);

      if (response.data.data && response.data.data.signNowDocumentId) {
        console.log(
          `🔗 SignNow Document ID: ${response.data.data.signNowDocumentId}`
        );
        console.log(
          `🔗 SignNow URL: https://app.signnow.com/webapp/document/${response.data.data.signNowDocumentId}`
        );
      }

      return response.data;
    } else {
      console.log('❌ Contract generation failed');
      console.log('Error:', response.data.error);
      return null;
    }
  } catch (error) {
    console.error(
      '❌ Error generating contract:',
      error.response?.data || error.message
    );

    if (error.response?.status === 404) {
      console.log('\n💡 Make sure the server is running on port 5050');
      console.log('Run: npm start or node src/server.js');
    }

    return null;
  }
}

// Run the script
generateLaborSupportContract().then((result) => {
  if (result) {
    console.log('\n🎉 Labor Support contract generation completed!');
    console.log(
      'The contract has been generated with perfect field coordinates.'
    );
  } else {
    console.log('\n❌ Failed to generate Labor Support contract');
  }
});





