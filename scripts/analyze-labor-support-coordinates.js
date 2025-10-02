const axios = require('axios');

async function analyzeLaborSupportCoordinates() {
    try {
        console.log('🔍 Analyzing Labor Support Contract Field Coordinates...');
        console.log('📋 Document ID: f1d8f4d8b2c849f88644b7276b4b466ec6df8620');
        console.log('🌐 Document URL: https://app.signnow.com/webapp/document/f1d8f4d8b2c849f88644b7276b4b466ec6df8620');
        console.log('');
        
        const response = await axios.post('http://localhost:5050/api/contract-signing/get-field-coordinates', {
            documentId: 'f1d8f4d8b2c849f88644b7276b4b466ec6df8620'
        });

        console.log('✅ Field coordinates retrieved successfully!');
        console.log('📊 Field Analysis:');
        console.log('==================');
        
        if (response.data.fields && response.data.fields.length > 0) {
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
            
            console.log('\n🎯 Field Summary:');
            console.log('==================');
            console.log(`Total Fields Found: ${response.data.fields.length}`);
            
            // Group fields by type
            const fieldTypes = {};
            response.data.fields.forEach(field => {
                if (!fieldTypes[field.type]) {
                    fieldTypes[field.type] = [];
                }
                fieldTypes[field.type].push(field);
            });
            
            Object.keys(fieldTypes).forEach(type => {
                console.log(`\n${type.toUpperCase()} Fields: ${fieldTypes[type].length}`);
                fieldTypes[type].forEach(field => {
                    console.log(`  - ${field.name} at (${field.x}, ${field.y})`);
                });
            });
            
            // Check for specific fields we need for labor support contract
            console.log('\n🔍 Labor Support Contract Field Analysis:');
            console.log('==========================================');
            
            const requiredFields = [
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
            
            requiredFields.forEach(requiredField => {
                const found = response.data.fields.find(field => 
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
            
            const financialFields = response.data.fields.filter(field => 
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
        console.error('❌ Error analyzing coordinates:', error.response?.data || error.message);
        console.log('\n💡 Make sure your server is running on localhost:5050');
        console.log('💡 Check that the SignNow service is properly configured');
    }
}

analyzeLaborSupportCoordinates();

