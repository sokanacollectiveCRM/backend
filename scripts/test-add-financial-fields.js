const axios = require('axios');

async function testAddFinancialFields() {
    try {
        console.log('🧪 Testing Addition of Financial Fields to Labor Support Contract');
        console.log('📋 Template ID: f1d8f4d8b2c849f88644b7276b4b466ec6df8620');
        console.log('');

        // First authenticate
        console.log('🔐 Authenticating...');
        const authResponse = await axios.post('http://localhost:5050/api/signnow/test-auth');
        console.log('✅ Authentication successful');
        console.log('');

        // Test adding financial fields to the template
        console.log('💰 Adding financial fields to Labor Support Contract...');

        const templateId = 'f1d8f4d8b2c849f88644b7276b4b466ec6df8620';

        // Define the financial fields we want to add
        const financialFields = [
            {
                type: 'text',
                name: 'total_amount',
                label: 'Total Amount',
                page_number: 1,
                x: 400,  // Position near the financial section
                y: 200,  // Adjust based on document layout
                width: 120,
                height: 25,
                required: true,
                role: 'Recipient 1'
            },
            {
                type: 'text',
                name: 'deposit_amount',
                label: 'Deposit Amount',
                page_number: 1,
                x: 400,
                y: 230,  // Below total amount
                width: 120,
                height: 25,
                required: true,
                role: 'Recipient 1'
            }
        ];

        console.log('📝 Financial fields to add:');
        financialFields.forEach(field => {
            console.log(`  - ${field.name}: ${field.label} at (${field.x}, ${field.y})`);
        });

        // Try to add fields using the SignNow service
        try {
            const addFieldsResponse = await axios.post('http://localhost:5050/api/signnow/add-fields', {
                documentId: templateId,
                fields: financialFields
            });

            console.log('✅ Financial fields added successfully!');
            console.log('📊 Response:', JSON.stringify(addFieldsResponse.data, null, 2));

        } catch (addFieldsError) {
            console.log('❌ Failed to add financial fields');
            console.log(`📊 Error: ${addFieldsError.response?.status} - ${addFieldsError.response?.data?.message || addFieldsError.message}`);

            if (addFieldsError.response?.data) {
                console.log('📊 Full error details:');
                console.log(JSON.stringify(addFieldsError.response.data, null, 2));
            }
        }

        // Verify the fields were added by getting the template fields again
        console.log('\n🔍 Verifying fields were added...');
        try {
            const verifyResponse = await axios.post('http://localhost:5050/api/signnow/template-fields');
            console.log('✅ Template fields retrieved');

            const fields = verifyResponse.data.fields;
            console.log(`📊 Total fields: ${fields.length}`);

            // Check for our financial fields
            const totalAmountField = fields.find(f => f.name === 'total_amount');
            const depositAmountField = fields.find(f => f.name === 'deposit_amount');

            if (totalAmountField) {
                console.log('✅ total_amount field found:');
                console.log(`   Position: (${totalAmountField.json_attributes.x}, ${totalAmountField.json_attributes.y})`);
                console.log(`   Dimensions: ${totalAmountField.json_attributes.width} x ${totalAmountField.json_attributes.height}`);
            } else {
                console.log('❌ total_amount field not found');
            }

            if (depositAmountField) {
                console.log('✅ deposit_amount field found:');
                console.log(`   Position: (${depositAmountField.json_attributes.x}, ${depositAmountField.json_attributes.y})`);
                console.log(`   Dimensions: ${depositAmountField.json_attributes.width} x ${depositAmountField.json_attributes.height}`);
            } else {
                console.log('❌ deposit_amount field not found');
            }

        } catch (verifyError) {
            console.log('❌ Failed to verify fields');
            console.log(`📊 Error: ${verifyError.response?.status} - ${verifyError.response?.data?.message || verifyError.message}`);
        }

    } catch (error) {
        console.error('❌ Error testing financial fields:', error.response?.data || error.message);
    }
}

testAddFinancialFields();

