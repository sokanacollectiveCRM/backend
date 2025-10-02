const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function testPostpartumContractRedirect() {
  console.log('🧪 Testing Postpartum Contract Redirect (should go to success page)...');

  const contractData = {
    clientName: 'Jerry Techluminate',
    clientEmail: 'jerry@techluminateacademy.com',
    totalHours: '10',
    hourlyRate: '45.00',
    overnightFee: '25.00',
    serviceType: 'Postpartum Doula Services', // This should trigger success page redirect
    contractDate: '2025-10-02',
    dueDate: '2025-11-01',
    startDate: '2025-10-02',
    endDate: '2025-12-31'
  };

  try {
    const response = await axios.post(`${BASE_URL}/api/contract-signing/generate-contract`, contractData);
    console.log('✅ Postpartum Contract Response:', response.data);
    console.log('🎯 Expected redirect URL: /contract-signed?contract_id=...');
    console.log('🎯 Should NOT create payment schedule');
    console.log('🎯 Should NOT redirect to payment page');
  } catch (error) {
    console.error('❌ Postpartum Contract Error:', error.response?.data || error.message);
  }
}

async function testLaborSupportContractRedirect() {
  console.log('\n🧪 Testing Labor Support Contract Redirect (should go to payment page)...');

  const contractData = {
    clientName: 'Jerry Techluminate',
    clientEmail: 'jerry@techluminateacademy.com',
    totalInvestment: '$2,500',
    depositAmount: '$300',
    remainingBalance: '$2,200',
    serviceType: 'Labor Support Services', // This should trigger payment page redirect
    contractDate: '2025-10-02',
    dueDate: '2025-11-01',
    startDate: '2025-10-02',
    endDate: '2025-12-31'
  };

  try {
    const response = await axios.post(`${BASE_URL}/api/contract-signing/generate-contract`, contractData);
    console.log('✅ Labor Support Contract Response:', response.data);
    console.log('🎯 Expected redirect URL: /payment?contract_id=...');
    console.log('🎯 Should create payment schedule');
    console.log('🎯 Should redirect to payment page');
  } catch (error) {
    console.error('❌ Labor Support Contract Error:', error.response?.data || error.message);
  }
}

async function runTests() {
  console.log('🚀 Testing Contract Type Redirect Logic\n');

  await testPostpartumContractRedirect();
  await testLaborSupportContractRedirect();

  console.log('\n✅ Tests completed!');
  console.log('\n📋 Expected Behavior:');
  console.log('  • Postpartum: Contract → SignNow → Success Page (no payment)');
  console.log('  • Labor Support: Contract → SignNow → Payment Page → Stripe');
}

runTests();
