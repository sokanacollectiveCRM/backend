const axios = require('axios');

async function accessTemplateDirectly() {
    try {
        console.log('🔍 Direct Template Access Test');
        console.log('📋 Template ID: f1d8f4d8b2c849f88644b7276b4b466ec6df8620');
        console.log('');

        // First authenticate
        console.log('🔐 Authenticating...');
        const authResponse = await axios.post('http://localhost:5050/api/signnow/test-auth');
        console.log('✅ Authentication successful');
        console.log('');

        // Try to access the template directly using the SignNow service
        console.log('📋 Testing direct template access...');

        // We'll use the SignNow service directly to get the document
        const templateId = 'f1d8f4d8b2c849f88644b7276b4b466ec6df8620';

        try {
            // Try to get the document using the SignNow API directly
            const response = await axios.get(`https://api.signnow.com/document/${templateId}`, {
                headers: {
                    'Authorization': `Bearer ${authResponse.data.data.access_token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });

            console.log('✅ Template accessible via direct API!');
            console.log(`📄 Document name: ${response.data.document_name}`);
            console.log(`📊 Document status: ${response.data.status}`);
            console.log(`📊 Document ID: ${response.data.id}`);

            // Check if it has fields
            if (response.data.fields && response.data.fields.length > 0) {
                console.log(`\n📋 Found ${response.data.fields.length} fields:`);
                response.data.fields.forEach((field, index) => {
                    console.log(`\n📍 Field ${index + 1}:`);
                    console.log(`   Name: ${field.name || field.label || 'Unknown'}`);
                    console.log(`   Type: ${field.type || 'Unknown'}`);
                    console.log(`   Page: ${field.page_number || field.page || 'Unknown'}`);
                    console.log(`   Position: (${field.x || 'N/A'}, ${field.y || 'N/A'})`);
                    console.log(`   Dimensions: ${field.width || 'N/A'} x ${field.height || 'N/A'}`);
                    console.log(`   Role: ${field.role || 'Unknown'}`);
                    console.log(`   Required: ${field.required || 'Unknown'}`);
                    console.log(`   ID: ${field.id || 'Unknown'}`);
                });

                // Check for labor support specific fields
                console.log('\n🎯 Labor Support Field Analysis:');
                console.log('================================');

                const laborSupportFields = ['client_initials', 'signature_date', 'client_signature'];
                const foundFields = [];
                const missingFields = [];

                laborSupportFields.forEach(requiredField => {
                    const found = response.data.fields.find(field => {
                        const fieldName = (field.name || field.label || '').toLowerCase();
                        return fieldName.includes(requiredField.toLowerCase()) ||
                               fieldName.includes(requiredField.replace('_', '').toLowerCase());
                    });

                    if (found) {
                        foundFields.push({
                            required: requiredField,
                            actual: found.name || found.label,
                            position: `(${found.x || 'N/A'}, ${found.y || 'N/A'})`,
                            type: found.type || 'Unknown'
                        });
                    } else {
                        missingFields.push(requiredField);
                    }
                });

                console.log('\n✅ Found Fields:');
                foundFields.forEach(field => {
                    console.log(`  - ${field.required} → ${field.actual} at ${field.position} (${field.type})`);
                });

                if (missingFields.length > 0) {
                    console.log('\n❌ Missing Fields:');
                    missingFields.forEach(field => {
                        console.log(`  - ${field}`);
                    });
                }

                // Generate code for SignNow service
                console.log('\n💻 Generated Code for SignNow Service:');
                console.log('=====================================');
                console.log('');
                console.log('// Labor Support Contract Template Field Coordinates');
                console.log('const laborSupportTemplateFields = [');

                response.data.fields.forEach(field => {
                    console.log(`  {`);
                    console.log(`    page_number: ${field.page_number || field.page || 1},`);
                    console.log(`    type: "${field.type || 'text'}",`);
                    console.log(`    name: "${field.name || field.label || 'unknown'}",`);
                    console.log(`    role: "${field.role || 'Signer 1'}",`);
                    console.log(`    required: ${field.required || true},`);
                    console.log(`    height: ${field.height || 50},`);
                    console.log(`    width: ${field.width || 150},`);
                    console.log(`    x: ${field.x || 100},`);
                    console.log(`    y: ${field.y || 200}`);
                    console.log(`  },`);
                });

                console.log('];');
                console.log('');
                console.log('✅ Use these coordinates in your SignNow service!');

            } else {
                console.log('📋 No fields found in template');
            }

        } catch (templateError) {
            console.log('❌ Template not accessible via direct API');
            console.log(`📊 Error: ${templateError.response?.status} - ${templateError.response?.data?.message || templateError.message}`);

            if (templateError.response?.data) {
                console.log('📊 Full error details:');
                console.log(JSON.stringify(templateError.response.data, null, 2));
            }
        }

    } catch (error) {
        console.error('❌ Error accessing template:', error.response?.data || error.message);
    }
}

accessTemplateDirectly();

