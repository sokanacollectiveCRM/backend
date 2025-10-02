const axios = require('axios');

async function checkLaborSupportTemplate() {
    try {
        console.log('🔍 Checking Labor Support Template...');
        console.log('📋 Document ID: f1d8f4d8b2c849f88644b7276b4b466ec6df8620');
        console.log('🌐 Document URL: https://app.signnow.com/webapp/document/f1d8f4d8b2c849f88644b7276b4b466ec6df8620');
        console.log('');

        // First, let's test authentication
        console.log('🔐 Testing SignNow authentication...');
        const authResponse = await axios.post('http://localhost:5050/api/signnow/test-auth');
        console.log('✅ Authentication successful');
        console.log('');

        // Now try to get the document fields
        console.log('📄 Getting document fields...');
        const fieldResponse = await axios.post('http://localhost:5050/api/contract-signing/get-field-coordinates', {
            documentId: 'f1d8f4d8b2c849f88644b7276b4b466ec6df8620'
        });

        console.log('✅ Document fields retrieved successfully!');
        console.log('📊 Field Analysis:');
        console.log('==================');

        if (fieldResponse.data.fields && fieldResponse.data.fields.length > 0) {
            fieldResponse.data.fields.forEach((field, index) => {
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
                'client_name',
                'client_signature',
                'client_signed_date',
                'client_initials',
                'total_amount',
                'deposit_amount',
                'balance_amount'
            ];

            const foundFields = [];
            const missingFields = [];

            laborSupportFields.forEach(requiredField => {
                const found = fieldResponse.data.fields.find(field =>
                    field.name.toLowerCase().includes(requiredField.toLowerCase()) ||
                    field.name.toLowerCase().includes(requiredField.replace('_', '').toLowerCase())
                );

                if (found) {
                    foundFields.push({
                        required: requiredField,
                        actual: found.name,
                        position: `(${found.x}, ${found.y})`,
                        type: found.type
                    });
                } else {
                    missingFields.push(requiredField);
                }
            });

            console.log('\n✅ Found Required Fields:');
            foundFields.forEach(field => {
                console.log(`  - ${field.required} → ${field.actual} at ${field.position} (${field.type})`);
            });

            console.log('\n❌ Missing Required Fields:');
            missingFields.forEach(field => {
                console.log(`  - ${field}`);
            });

            // Analyze field positioning for financial amounts
            console.log('\n💰 Financial Fields Analysis:');
            console.log('============================');

            const financialFields = fieldResponse.data.fields.filter(field =>
                field.name.toLowerCase().includes('amount') ||
                field.name.toLowerCase().includes('total') ||
                field.name.toLowerCase().includes('deposit') ||
                field.name.toLowerCase().includes('balance')
            );

            if (financialFields.length > 0) {
                console.log('Found financial fields:');
                financialFields.forEach(field => {
                    console.log(`  - ${field.name} at (${field.x}, ${field.y}) - ${field.type}`);
                });
            } else {
                console.log('No financial fields found - need to add deposit_amount and balance_amount fields');
            }

        } else {
            console.log('❌ No fields found in document');
        }

    } catch (error) {
        console.error('❌ Error checking template:', error.response?.data || error.message);

        if (error.response?.status === 400) {
            console.log('\n💡 Document access issue. Possible causes:');
            console.log('   - Document ID might be incorrect');
            console.log('   - Document might not be accessible with current credentials');
            console.log('   - Document might be in a different workspace');
            console.log('\n🔧 Let\'s try to list available documents first...');
        }
    }
}

checkLaborSupportTemplate();

