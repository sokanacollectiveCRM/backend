const axios = require('axios');

async function getPostpartumCoordinates() {
    try {
        console.log('🔍 Getting Postpartum Contract Field Coordinates');
        console.log('📋 Template: https://app.signnow.com/webapp/document/3cc4323f75af4986b9a142513185d2b13d300759');
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

        // Get Postpartum template fields
        console.log('📋 Getting Postpartum template fields...');
        try {
            const fieldsResponse = await axios.post('http://localhost:5050/api/signnow/postpartum-template-fields');
            console.log('✅ Postpartum template fields retrieved successfully');
            console.log('📊 Response:', JSON.stringify(fieldsResponse.data, null, 2));

            if (fieldsResponse.data.success && fieldsResponse.data.fields) {
                console.log('\n🎯 Field Coordinates for Postpartum Contract:');
                fieldsResponse.data.fields.forEach((field, index) => {
                    console.log(`   ${index + 1}. ${field.name || field.id}:`);
                    console.log(`      - Page: ${field.json_attributes?.page_number || 'N/A'}`);
                    console.log(`      - Type: ${field.type}`);
                    console.log(`      - Position: x=${field.json_attributes?.x}, y=${field.json_attributes?.y}`);
                    console.log(`      - Size: width=${field.json_attributes?.width}, height=${field.json_attributes?.height}`);
                    console.log(`      - Required: ${field.json_attributes?.required}`);
                    console.log('');
                });

                console.log('💡 Use these coordinates to update the Postpartum field positioning in the code');
            }

        } catch (fieldsError) {
            console.log('❌ Error getting Postpartum template fields:', fieldsError.response?.data?.message || fieldsError.message);
        }

    } catch (error) {
        console.error('❌ Error getting Postpartum coordinates:', error.message);
    }
}

getPostpartumCoordinates();
