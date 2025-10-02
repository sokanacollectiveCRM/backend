const axios = require('axios');

async function listAvailableTemplates() {
    try {
        console.log('🔍 Listing Available Templates');
        console.log('📧 Account: jerrybony5@gmail.com');
        console.log('');
        
        // First authenticate
        console.log('🔐 Authenticating...');
        const authResponse = await axios.post('http://localhost:5050/api/signnow/test-auth');
        console.log('✅ Authentication successful');
        console.log('');
        
        // Try to get user documents instead of templates
        console.log('📋 Getting user documents...');
        
        try {
            // Try to get user documents using the SignNow API directly
            const response = await axios.get(`https://api.signnow.com/user/documents`, {
                headers: {
                    'Authorization': `Bearer ${authResponse.data.data.access_token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });
            
            console.log('✅ Documents retrieved successfully!');
            console.log(`📊 Found ${response.data.length} documents:`);
            
            response.data.forEach((doc, index) => {
                console.log(`\n📄 Document ${index + 1}:`);
                console.log(`   Name: ${doc.document_name}`);
                console.log(`   ID: ${doc.id}`);
                console.log(`   Status: ${doc.status}`);
                console.log(`   Created: ${doc.created}`);
                console.log(`   Modified: ${doc.modified}`);
                
                // Check if this is the labor support contract
                if (doc.document_name.toLowerCase().includes('labor') || 
                    doc.document_name.toLowerCase().includes('support') ||
                    doc.id === 'f1d8f4d8b2c849f88644b7276b4b466ec6df8620') {
                    console.log('   🎯 This might be the Labor Support Contract!');
                }
            });
            
            // Look for the specific template ID
            const targetTemplate = response.data.find(doc => doc.id === 'f1d8f4d8b2c849f88644b7276b4b466ec6df8620');
            if (targetTemplate) {
                console.log('\n🎯 Found the target template!');
                console.log(`📄 Name: ${targetTemplate.document_name}`);
                console.log(`📊 Status: ${targetTemplate.status}`);
                console.log(`📊 ID: ${targetTemplate.id}`);
            } else {
                console.log('\n❌ Target template f1d8f4d8b2c849f88644b7276b4b466ec6df8620 not found');
                console.log('💡 The template might be in a different account or workspace');
            }
            
        } catch (docError) {
            console.log('❌ Could not retrieve documents');
            console.log(`📊 Error: ${docError.response?.status} - ${docError.response?.data?.message || docError.message}`);
            
            if (docError.response?.data) {
                console.log('📊 Full error details:');
                console.log(JSON.stringify(docError.response.data, null, 2));
            }
        }
        
    } catch (error) {
        console.error('❌ Error listing templates:', error.response?.data || error.message);
    }
}

listAvailableTemplates();

