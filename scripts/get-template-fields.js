const axios = require('axios');

async function getTemplateFields() {
    try {
        console.log('🔍 Getting Labor Support Template Field Coordinates...');
        console.log('📋 Template ID: f1d8f4d8b2c849f88644b7276b4b466ec6df8620');
        console.log('🌐 Template URL: https://app.signnow.com/webapp/document/f1d8f4d8b2c849f88644b7276b4b466ec6df8620');
        console.log('');

        // Test authentication first
        console.log('🔐 Testing SignNow authentication...');
        const authResponse = await axios.post('http://localhost:5050/api/signnow/test-auth');
        console.log('✅ Authentication successful');
        console.log('');

        // Get template fields using the template route
        console.log('📄 Getting template fields...');
        const templateResponse = await axios.post('http://localhost:5050/api/signnow/template-fields', {
            templateId: 'f1d8f4d8b2c849f88644b7276b4b466ec6df8620'
        });

        if (templateResponse.data.success && templateResponse.data.fields) {
            console.log('✅ Template fields retrieved successfully!');
            console.log('📊 Field Analysis:');
            console.log('==================');

            templateResponse.data.fields.forEach((field, index) => {
                console.log(`\n📍 Field ${index + 1}:`);
                console.log(`   Name: ${field.name}`);
                console.log(`   Type: ${field.type}`);
                console.log(`   Page: ${field.page_number}`);
                console.log(`   Position: (${field.x}, ${field.y})`);
                console.log(`   Dimensions: ${field.width} x ${field.height}`);
                console.log(`   Role: ${field.role}`);
                console.log(`   Required: ${field.required}`);
            });

            // Check for labor support specific fields
            console.log('\n🎯 Labor Support Contract Field Analysis:');
            console.log('==========================================');

            const laborSupportFields = [
                'client_initials',
                'signature_date',
                'client_signature'
            ];

            const foundFields = [];
            const missingFields = [];

            laborSupportFields.forEach(requiredField => {
                const found = templateResponse.data.fields.find(field =>
                    field.name.toLowerCase().includes(requiredField.toLowerCase()) ||
                    field.name.toLowerCase().includes(requiredField.replace('_', '').toLowerCase())
                );

                if (found) {
                    foundFields.push({
                        required: requiredField,
                        actual: found.name,
                        position: `(${found.x}, ${found.y})`,
                        type: found.type,
                        page: found.page_number
                    });
                } else {
                    missingFields.push(requiredField);
                }
            });

            console.log('\n✅ Found Required Fields:');
            foundFields.forEach(field => {
                console.log(`  - ${field.required} → ${field.actual} at ${field.position} (${field.type}) on page ${field.page}`);
            });

            console.log('\n❌ Missing Required Fields:');
            missingFields.forEach(field => {
                console.log(`  - ${field}`);
            });

            // Generate code for the SignNow service
            console.log('\n💻 Code for SignNow Service:');
            console.log('============================');
            console.log('');
            console.log('// Labor Support Contract Template Field Coordinates');
            console.log('const laborSupportTemplateFields = [');

            templateResponse.data.fields.forEach(field => {
                console.log(`  {`);
                console.log(`    page_number: ${field.page_number},`);
                console.log(`    type: "${field.type}",`);
                console.log(`    name: "${field.name}",`);
                console.log(`    role: "${field.role}",`);
                console.log(`    required: ${field.required},`);
                console.log(`    height: ${field.height},`);
                console.log(`    width: ${field.width},`);
                console.log(`    x: ${field.x},`);
                console.log(`    y: ${field.y}`);
                console.log(`  },`);
            });

            console.log('];');
            console.log('');
            console.log('✅ Use these coordinates in your SignNow service for labor support contracts!');

        } else {
            console.log('❌ No fields found in template');
            console.log('💡 Make sure the template has the required fields added');
        }

    } catch (error) {
        console.error('❌ Error getting template fields:', error.response?.data || error.message);

        if (error.response?.status === 400) {
            console.log('\n💡 Template access issue. Possible solutions:');
            console.log('   1. Make sure the template exists and is accessible');
            console.log('   2. Check if the template is in the correct workspace');
            console.log('   3. Ensure you have read permissions for the template');
            console.log('   4. Try accessing the template directly in SignNow');
        }
    }
}

getTemplateFields();
