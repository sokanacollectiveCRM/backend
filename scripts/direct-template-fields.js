const axios = require('axios');

async function getDirectTemplateFields() {
    try {
        console.log('🔍 Getting Labor Support Template Fields (Direct API Call)...');
        console.log('📋 Template ID: f1d8f4d8b2c849f88644b7276b4b466ec6df8620');
        console.log('');

        // First get authentication
        console.log('🔐 Getting authentication...');
        const authResponse = await axios.post('http://localhost:5050/api/signnow/test-auth');
        console.log('✅ Authentication successful');
        console.log('');

        // Make direct API call to get template fields
        console.log('📄 Making direct API call to get template fields...');

        // Try different approaches to get the fields
        const approaches = [
            {
                name: 'Standard Document Fields',
                url: `https://api.signnow.com/document/f1d8f4d8b2c849f88644b7276b4b466ec6df8620`,
                method: 'GET'
            },
            {
                name: 'Template Fields',
                url: `https://api.signnow.com/template/f1d8f4d8b2c849f88644b7276b4b466ec6df8620`,
                method: 'GET'
            }
        ];

        for (const approach of approaches) {
            console.log(`\n🔍 Trying ${approach.name}...`);
            try {
                const response = await axios.get(approach.url, {
                    headers: {
                        'Authorization': `Bearer ${authResponse.data.data.access_token}`,
                        'Content-Type': 'application/json'
                    }
                });

                console.log(`✅ ${approach.name} successful!`);
                console.log('📊 Response structure:');
                console.log('====================');

                // Log the response structure to understand what we're getting
                if (response.data.fields) {
                    console.log(`Found ${response.data.fields.length} fields:`);
                    response.data.fields.forEach((field, index) => {
                        console.log(`\n📍 Field ${index + 1}:`);
                        console.log(`   Name: ${field.name}`);
                        console.log(`   Type: ${field.type}`);
                        console.log(`   Page: ${field.page_number}`);
                        console.log(`   Position: (${field.x}, ${field.y})`);
                        console.log(`   Dimensions: ${field.width} x ${field.height}`);
                        console.log(`   Role: ${field.role}`);
                        console.log(`   Required: ${field.required}`);
                    });
                } else if (response.data.texts) {
                    console.log(`Found ${response.data.texts.length} text fields:`);
                    response.data.texts.forEach((field, index) => {
                        console.log(`\n📍 Text Field ${index + 1}:`);
                        console.log(`   Name: ${field.name}`);
                        console.log(`   Label: ${field.label}`);
                        console.log(`   ID: ${field.id}`);
                        console.log(`   Required: ${field.required}`);
                    });
                } else {
                    console.log('📋 Available data keys:', Object.keys(response.data));
                    console.log('📋 Full response structure:');
                    console.log(JSON.stringify(response.data, null, 2));
                }

                // Check for labor support specific fields
                const allFields = response.data.fields || response.data.texts || [];
                const laborSupportFields = ['client_initials', 'signature_date', 'client_signature'];

                console.log('\n🎯 Labor Support Field Analysis:');
                console.log('================================');

                laborSupportFields.forEach(requiredField => {
                    const found = allFields.find(field =>
                        field.name && field.name.toLowerCase().includes(requiredField.toLowerCase())
                    );

                    if (found) {
                        console.log(`✅ Found: ${requiredField} → ${found.name}`);
                        if (found.x && found.y) {
                            console.log(`   Position: (${found.x}, ${found.y})`);
                        }
                    } else {
                        console.log(`❌ Missing: ${requiredField}`);
                    }
                });

                return; // Exit on first successful approach

            } catch (error) {
                console.log(`❌ ${approach.name} failed: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
            }
        }

        console.log('\n💡 All approaches failed. Possible issues:');
        console.log('   1. Template might not have fields saved properly');
        console.log('   2. Template might be in a different workspace');
        console.log('   3. API endpoint might be different for templates');
        console.log('   4. Fields might need to be published/saved in SignNow');

    } catch (error) {
        console.error('❌ Error getting template fields:', error.response?.data || error.message);
    }
}

getDirectTemplateFields();

