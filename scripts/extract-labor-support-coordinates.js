const axios = require('axios');

async function extractLaborSupportCoordinates() {
    try {
        console.log('🔍 Extracting Labor Support Contract Field Coordinates...');
        console.log('📋 Document ID: f1d8f4d8b2c849f88644b7276b4b466ec6df8620');
        console.log('🌐 Document URL: https://app.signnow.com/webapp/document/f1d8f4d8b2c849f88644b7276b4b466ec6df8620');
        console.log('');

        console.log('📝 INSTRUCTIONS:');
        console.log('==========');
        console.log('1. Open the SignNow document in your browser');
        console.log('2. Add ONLY these 3 client fields manually:');
        console.log('   - client_initials field (for client to initial)');
        console.log('   - signature_date field (for client to enter date)');
        console.log('   - client_signature field (for client to sign)');
        console.log('3. Position them where they should appear in the contract');
        console.log('4. Save the document as a template');
        console.log('5. Run this script to extract the coordinates');
        console.log('');
        console.log('💡 NOTE: deposit_amount and balance_amount will be pre-filled by backend');
        console.log('   Client only needs to initial, date, and sign!');
        console.log('');

        // Test authentication first
        console.log('🔐 Testing SignNow authentication...');
        const authResponse = await axios.post('http://localhost:5050/api/signnow/test-auth');
        console.log('✅ Authentication successful');
        console.log('');

        // Try to get field coordinates
        console.log('📄 Getting field coordinates...');
        const fieldResponse = await axios.post('http://localhost:5050/api/contract-signing/get-field-coordinates', {
            documentId: 'f1d8f4d8b2c849f88644b7276b4b466ec6df8620'
        });

        if (fieldResponse.data.fields && fieldResponse.data.fields.length > 0) {
            console.log('✅ Field coordinates extracted successfully!');
            console.log('📊 Field Analysis:');
            console.log('==================');

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
                'client_initials',
                'signature_date',
                'client_signature'
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
            console.log('// Labor Support Contract Field Coordinates');
            console.log('const laborSupportFields = [');

            fieldResponse.data.fields.forEach(field => {
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
            console.log('❌ No fields found in document');
            console.log('💡 Make sure you have added the fields and saved the document');
        }

    } catch (error) {
        console.error('❌ Error extracting coordinates:', error.response?.data || error.message);

        if (error.response?.status === 400 && error.response?.data?.details?.includes('not readable')) {
            console.log('\n💡 Document access issue. Possible solutions:');
            console.log('   1. Make sure the document is saved and accessible');
            console.log('   2. Check if the document is in the correct workspace');
            console.log('   3. Ensure you have read permissions for the document');
            console.log('   4. Try refreshing the document in SignNow and saving again');
        }
    }
}

extractLaborSupportCoordinates();
