const axios = require('axios');

async function testSignNowAuth() {
    try {
        console.log('🔐 Testing SignNow Authentication...');
        console.log('=====================================');

        // Test authentication first
        const authResponse = await axios.post('http://localhost:5050/api/contract-signing/test-auth');
        console.log('✅ Authentication test result:', authResponse.data);

        // If auth is successful, get field coordinates
        console.log('\n🔍 Getting field coordinates for labor support contract...');
        const fieldResponse = await axios.post('http://localhost:5050/api/contract-signing/get-field-coordinates', {
            documentId: 'f1d8f4d8b2c849f88644b7276b4b466ec6df8620'
        });

        console.log('✅ Field coordinates retrieved:');
        console.log(JSON.stringify(fieldResponse.data, null, 2));

    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);

        if (error.response?.status === 401) {
            console.log('\n💡 Authentication failed. Check SignNow credentials:');
            console.log('   - SIGNNOW_CLIENT_ID');
            console.log('   - SIGNNOW_CLIENT_SECRET');
            console.log('   - SIGNNOW_USERNAME');
            console.log('   - SIGNNOW_PASSWORD');
        }
    }
}

testSignNowAuth();
