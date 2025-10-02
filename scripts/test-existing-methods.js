const axios = require('axios');

async function testExistingSignNowMethods() {
    try {
        console.log('🔍 Testing Existing SignNow Methods');
        console.log('📧 Account: jerrybony5@gmail.com');
        console.log('📋 Template ID: f1d8f4d8b2c849f88644b7276b4b466ec6df8620');
        console.log('');

        // Test authentication
        console.log('🔐 Testing authentication...');
        const authResponse = await axios.post('http://localhost:5050/api/signnow/test-auth');
        console.log('✅ Authentication successful');
        console.log(`📧 Account: ${authResponse.data.data.emails[0]}`);
        console.log('');

        // Try to test the template using the existing test-template endpoint
        console.log('📋 Testing template using existing endpoint...');
        try {
            const templateResponse = await axios.post('http://localhost:5050/api/signnow/test-template');
            console.log('✅ Template test successful!');
            console.log(`📄 Template data:`, JSON.stringify(templateResponse.data, null, 2));
        } catch (templateError) {
            console.log('❌ Template test failed');
            console.log(`📊 Error: ${templateError.response?.status} - ${templateError.response?.data?.message || templateError.message}`);
        }

        // Try to get template fields using the existing endpoint
        console.log('\n📋 Testing template fields endpoint...');
        try {
            const fieldsResponse = await axios.post('http://localhost:5050/api/signnow/template-fields');
            console.log('✅ Template fields retrieved!');
            console.log(`📄 Fields data:`, JSON.stringify(fieldsResponse.data, null, 2));
        } catch (fieldsError) {
            console.log('❌ Template fields failed');
            console.log(`📊 Error: ${fieldsError.response?.status} - ${fieldsError.response?.data?.message || fieldsError.message}`);
        }

        // Try to list templates using the existing endpoint
        console.log('\n📋 Testing list templates endpoint...');
        try {
            const listResponse = await axios.post('http://localhost:5050/api/signnow/list-templates');
            console.log('✅ Templates listed successfully!');
            console.log(`📄 Templates data:`, JSON.stringify(listResponse.data, null, 2));
        } catch (listError) {
            console.log('❌ List templates failed');
            console.log(`📊 Error: ${listError.response?.status} - ${listError.response?.data?.message || listError.message}`);
        }

    } catch (error) {
        console.error('❌ Error testing SignNow methods:', error.response?.data || error.message);
    }
}

testExistingSignNowMethods();

