const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function testPostpartumWithDifferentHourFields() {
  console.log('🔍 Testing Postpartum Contract with different hour field names...');

  // Test 1: Using totalHours
  console.log('\n📋 Test 1: Using totalHours field');
  const contractData1 = {
    clientName: 'Jerry Techluminate',
    clientEmail: 'jerry@techluminateacademy.com',
    totalHours: '10', // This should work
    deposit: '600.00',
    hourlyRate: '35.00',
    overnightFee: '0.00',
    totalAmount: '4,200.00',
    serviceType: 'Postpartum Doula Services',
    contractDate: '2025-10-02',
    dueDate: '2025-11-01',
    startDate: '2025-10-02',
    endDate: '2025-12-31'
  };

  try {
    const response1 = await axios.post(`${BASE_URL}/api/contract-signing/generate-contract`, contractData1);
    console.log('✅ Response 1:', response1.data);
  } catch (error) {
    console.error('❌ Error 1:', error.response?.data || error.message);
  }

  // Test 2: Using hours
  console.log('\n📋 Test 2: Using hours field');
  const contractData2 = {
    clientName: 'Jerry Techluminate',
    clientEmail: 'jerry@techluminateacademy.com',
    hours: '10', // Different field name
    deposit: '600.00',
    hourlyRate: '35.00',
    overnightFee: '0.00',
    totalAmount: '4,200.00',
    serviceType: 'Postpartum Doula Services',
    contractDate: '2025-10-02',
    dueDate: '2025-11-01',
    startDate: '2025-10-02',
    endDate: '2025-12-31'
  };

  try {
    const response2 = await axios.post(`${BASE_URL}/api/contract-signing/generate-contract`, contractData2);
    console.log('✅ Response 2:', response2.data);
  } catch (error) {
    console.error('❌ Error 2:', error.response?.data || error.message);
  }

  // Test 3: Using totalHours with different casing
  console.log('\n📋 Test 3: Using totalHours (different casing)');
  const contractData3 = {
    clientName: 'Jerry Techluminate',
    clientEmail: 'jerry@techluminateacademy.com',
    totalhours: '10', // Different casing
    deposit: '600.00',
    hourlyRate: '35.00',
    overnightFee: '0.00',
    totalAmount: '4,200.00',
    serviceType: 'Postpartum Doula Services',
    contractDate: '2025-10-02',
    dueDate: '2025-11-01',
    startDate: '2025-10-02',
    endDate: '2025-12-31'
  };

  try {
    const response3 = await axios.post(`${BASE_URL}/api/contract-signing/generate-contract`, contractData3);
    console.log('✅ Response 3:', response3.data);
  } catch (error) {
    console.error('❌ Error 3:', error.response?.data || error.message);
  }
}

async function runDebug() {
  console.log('🚀 Debugging Postpartum Hours Field Issue\n');

  await testPostpartumWithDifferentHourFields();

  console.log('\n✅ Debug tests completed!');
  console.log('\n📋 Check the generated contracts to see which field name works for hours');
}

runDebug();
