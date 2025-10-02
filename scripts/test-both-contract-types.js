const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function testLaborSupportContract() {
  console.log('🧪 Testing Labor Support Contract (should create payment schedule)...');

  const contractData = {
    clientName: 'Jerry Techluminate',
    clientEmail: 'jerry@techluminateacademy.com',
    totalInvestment: '$2,500',
    depositAmount: '$300',
    remainingBalance: '$2,200',
    serviceType: 'Labor Support Services', // This should trigger payment processing
    contractDate: '2025-10-02',
    dueDate: '2025-11-01',
    startDate: '2025-10-02',
    endDate: '2025-12-31'
  };

  try {
    const response = await axios.post(`${BASE_URL}/api/contract-signing/generate-contract`, contractData);
    console.log('✅ Labor Support Contract Response:', response.data);
    console.log('🎯 Should redirect to: /payment?contract_id=...');
  } catch (error) {
    console.error('❌ Labor Support Contract Error:', error.response?.data || error.message);
  }
}

async function testPostpartumContract() {
  console.log('\n🧪 Testing Postpartum Contract (should skip payment processing)...');

  const contractData = {
    clientName: 'Jerry Techluminate',
    clientEmail: 'jerry@techluminateacademy.com',
    totalHours: '120',
    deposit: '600.00',
    hourlyRate: '35.00',
    overnightFee: '0.00',
    totalAmount: '4,200.00',
    serviceType: 'Postpartum Doula Services', // This should skip payment processing
    contractDate: '2025-10-02',
    dueDate: '2025-11-01',
    startDate: '2025-10-02',
    endDate: '2025-12-31'
  };

  try {
    const response = await axios.post(`${BASE_URL}/api/contract-signing/generate-contract`, contractData);
    console.log('✅ Postpartum Contract Response:', response.data);
    console.log('🎯 Should redirect to: /contract-signed?contract_id=...');
  } catch (error) {
    console.error('❌ Postpartum Contract Error:', error.response?.data || error.message);
  }
}

async function runTests() {
  console.log('🚀 Testing Contract Type Conditional Logic\n');

  await testLaborSupportContract();
  await testPostpartumContract();

  console.log('\n✅ Tests completed!');
  console.log('\n📋 Expected Behavior:');
  console.log('  • Labor Support: Creates payment schedule + redirects to payment page');
  console.log('  • Postpartum: Skips payment schedule + redirects to success page');
}

runTests();
