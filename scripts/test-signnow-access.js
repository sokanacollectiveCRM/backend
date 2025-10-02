const axios = require('axios');

async function testSignNowAccess() {
    try {
        console.log('🔍 Testing SignNow Access...');
        console.log('📧 Account: jerry@techluminateacademy.com');
        console.log('📋 Template ID: f1d8f4d8b2c849f88644b7276b4b466ec6df8620');
        console.log('');

        // Test authentication first
        console.log('🔐 Testing authentication...');
        const authResponse = await axios.post('http://localhost:5050/api/signnow/test-auth');
        console.log('✅ Authentication successful');
        console.log('');

        // Test template access using available endpoints
        console.log('📋 Testing template access...');
        const templateId = 'f1d8f4d8b2c849f88644b7276b4b466ec6df8620';

        // Try to list templates first
        console.log('📋 Listing all templates...');
        try {
            const templatesResponse = await axios.post('http://localhost:5050/api/signnow/list-templates');
            console.log('✅ Templates retrieved');
            const templates = templatesResponse.data.data;
            console.log(`📊 Found ${templates.length} templates:`);

            let foundTemplate = null;
            templates.forEach((template, index) => {
                console.log(`  ${index + 1}. ${template.document_name} (ID: ${template.id})`);
                if (template.id === templateId) {
                    foundTemplate = template;
                    console.log('     🎯 This is the Labor Support Contract template!');
                }
            });

            if (foundTemplate) {
                console.log('\n✅ Labor Support Contract template found!');
                console.log(`📄 Template name: ${foundTemplate.document_name}`);
                console.log(`📊 Template status: ${foundTemplate.status}`);
                console.log(`📊 Template ID: ${foundTemplate.id}`);
            } else {
                console.log('\n❌ Labor Support Contract template not found in available templates');
                console.log('💡 The template might be in a different workspace or not accessible');
            }

        } catch (templatesError) {
            console.log('❌ Could not list templates');
            console.log(`📊 Error: ${templatesError.response?.status} - ${templatesError.response?.data?.message || templatesError.message}`);
        }

    } catch (error) {
        console.error('❌ Error testing SignNow access:', error.response?.data || error.message);
    }
}

testSignNowAccess();
