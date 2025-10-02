const axios = require('axios');

async function directSignNowCheck() {
    try {
        console.log('🔍 Direct SignNow API Check...');
        console.log('📋 Document ID: f1d8f4d8b2c849f88644b7276b4b466ec6df8620');
        console.log('');

        // First get authentication
        console.log('🔐 Getting authentication...');
        const authResponse = await axios.post('http://localhost:5050/api/signnow/test-auth');
        console.log('✅ Authentication successful');
        console.log('');

        // Try to get user documents to see what's available
        console.log('📋 Checking available documents...');
        try {
            const userResponse = await axios.get('http://localhost:5050/api/signnow/user');
            console.log('✅ User info retrieved');
            console.log('📊 User has access to documents');
        } catch (userError) {
            console.log('❌ Could not get user info:', userError.response?.data || userError.message);
        }

        // Try different document ID formats
        const documentIds = [
            'f1d8f4d8b2c849f88644b7276b4b466ec6df8620',  // Original
            'f1d8f4d8-b2c8-49f8-8644-b7276b4b466e',      // With hyphens
            'f1d8f4d8b2c849f88644b7276b4b466ec6df8620'   // As is
        ];

        for (const docId of documentIds) {
            console.log(`\n🔍 Trying document ID: ${docId}`);
            try {
                const fieldResponse = await axios.post('http://localhost:5050/api/contract-signing/get-field-coordinates', {
                    documentId: docId
                });
                console.log('✅ Success! Found fields:');
                console.log(JSON.stringify(fieldResponse.data, null, 2));
                return; // Exit on first success
            } catch (error) {
                console.log(`❌ Failed: ${error.response?.data?.details || error.message}`);
            }
        }

        console.log('\n💡 All document ID formats failed. Possible issues:');
        console.log('   - Document might not exist in your SignNow account');
        console.log('   - Document might be in a different workspace');
        console.log('   - Document might require different permissions');
        console.log('   - Document ID might be from a different SignNow environment');

        console.log('\n🔧 Next steps:');
        console.log('   1. Verify the document exists in your SignNow account');
        console.log('   2. Check if the document is in the correct workspace');
        console.log('   3. Ensure you have read permissions for the document');
        console.log('   4. Try accessing the document directly in SignNow web interface');

    } catch (error) {
        console.error('❌ Error in direct check:', error.response?.data || error.message);
    }
}

directSignNowCheck();

