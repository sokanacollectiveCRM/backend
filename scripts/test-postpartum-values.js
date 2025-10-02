const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function testPostpartumWithSpecificValues() {
  console.log('🧪 Testing Postpartum Contract with specific values...');

  const contractData = {
    clientName: 'Jerry Techluminate',
    clientEmail: 'jerry@techluminateacademy.com',
    totalHours: '10',           // Should show 10 hours
    hourlyRate: '45.00',        // Should show $45.00/hour
    overnightFee: '25.00',      // Should show $25.00 overnight
    serviceType: 'Postpartum Doula Services',
    contractDate: '2025-10-02',
    dueDate: '2025-11-01',
    startDate: '2025-10-02',
    endDate: '2025-12-31'
  };

  console.log('📋 Sending contract data:', contractData);

  try {
    const response = await axios.post(`${BASE_URL}/api/contract-signing/generate-contract`, contractData);
    console.log('✅ Response:', response.data);

    // Check if the generated contract shows the correct values
    console.log('\n🔍 Check the generated contract file to verify:');
    console.log('  - Hours should show: 10 (not 120)');
    console.log('  - Hourly rate should show: 45.00 (not 35.00)');
    console.log('  - Overnight fee should show: 25.00 (not 0.00)');

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

async function testPostpartumWithAlternativeFields() {
  console.log('\n🧪 Testing Postpartum Contract with alternative field names...');

  const contractData = {
    clientName: 'Jerry Techluminate',
    clientEmail: 'jerry@techluminateacademy.com',
    hours: '15',                // Alternative field name
    rate: '50.00',             // Alternative field name
    overnight: '30.00',        // Alternative field name
    serviceType: 'Postpartum Doula Services',
    contractDate: '2025-10-02',
    dueDate: '2025-11-01',
    startDate: '2025-10-02',
    endDate: '2025-12-31'
  };

  console.log('📋 Sending contract data with alternative fields:', contractData);

  try {
    const response = await axios.post(`${BASE_URL}/api/contract-signing/generate-contract`, contractData);
    console.log('✅ Response:', response.data);

    console.log('\n🔍 Check the generated contract file to verify:');
    console.log('  - Hours should show: 15 (not 120)');
    console.log('  - Hourly rate should show: 50.00 (not 35.00)');
    console.log('  - Overnight fee should show: 30.00 (not 0.00)');

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

async function runTests() {
  console.log('🚀 Testing Postpartum Contract Values\n');

  await testPostpartumWithSpecificValues();
  await testPostpartumWithAlternativeFields();

  console.log('\n✅ Tests completed!');
  console.log('\n📋 Check the console logs for debug output showing what values are being received');
  console.log('📋 Check the generated contract files to see if the correct values are substituted');
}

runTests();
