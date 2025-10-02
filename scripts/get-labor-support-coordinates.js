const axios = require('axios');

async function getLaborSupportCoordinates() {
    try {
        console.log('🔍 Getting Labor Support Contract Field Coordinates');
        console.log('📋 Template: https://app.signnow.com/webapp/document/f1d8f4d8b2c849f88644b7276b4b466ec6df8620');
        console.log('');

        // Test SignNow authentication first
        console.log('🔐 Testing SignNow authentication...');
        try {
            const authResponse = await axios.post('http://localhost:5050/api/signnow/test-auth');
            console.log('✅ SignNow authentication successful');
        } catch (authError) {
            console.log('❌ SignNow authentication failed:', authError.response?.data?.message || authError.message);
            return;
        }

        console.log('');

        // Get template fields using the correct template ID
        console.log('📋 Getting template fields...');
        try {
            const fieldsResponse = await axios.post('http://localhost:5050/api/signnow/template-fields');
            console.log('✅ Template fields retrieved successfully');
            console.log('📊 Response:', JSON.stringify(fieldsResponse.data, null, 2));

            if (fieldsResponse.data.success && fieldsResponse.data.fields) {
                console.log('\n🎯 Field Coordinates for Labor Support Contract:');
                fieldsResponse.data.fields.forEach((field, index) => {
                    console.log(`   ${index + 1}. ${field.name}:`);
                    console.log(`      - Page: ${field.page_number}`);
                    console.log(`      - Type: ${field.type}`);
                    console.log(`      - Position: x=${field.x}, y=${field.y}`);
                    console.log(`      - Size: width=${field.width}, height=${field.height}`);
                    console.log(`      - Required: ${field.required}`);
                    console.log('');
                });

                console.log('💡 Use these coordinates to update the SignNow field positioning in the code');
            }

        } catch (fieldsError) {
            console.log('❌ Error getting template fields:', fieldsError.response?.data?.message || fieldsError.message);
        }

    } catch (error) {
        console.error('❌ Error getting Labor Support coordinates:', error.message);
    }
}

getLaborSupportCoordinates();

