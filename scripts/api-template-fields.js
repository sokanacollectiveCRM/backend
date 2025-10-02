const axios = require('axios');

async function getTemplateFieldsViaAPI() {
    try {
        console.log('🔍 Getting Template Fields via SignNow API...');
        console.log('📋 Template ID: f1d8f4d8b2c849f88644b7276b4b466ec6df8620');
        console.log('');
        
        // Get authentication
        console.log('🔐 Getting authentication...');
        const authResponse = await axios.post('http://localhost:5050/api/signnow/test-auth');
        const accessToken = authResponse.data.data.access_token;
        console.log('✅ Authentication successful');
        console.log('');
        
        // Try different SignNow API endpoints for templates
        const baseURL = 'https://api.signnow.com';
        const templateId = 'f1d8f4d8b2c849f88644b7276b4b466ec6df8620';
        
        const endpoints = [
            {
                name: 'Document Fields',
                url: `${baseURL}/document/${templateId}`,
                description: 'Get fields from document endpoint'
            },
            {
                name: 'Template Fields',
                url: `${baseURL}/template/${templateId}`,
                description: 'Get fields from template endpoint'
            },
            {
                name: 'Document with Fields',
                url: `${baseURL}/document/${templateId}?include=fields`,
                description: 'Get document with fields included'
            },
            {
                name: 'Document Fields Endpoint',
                url: `${baseURL}/document/${templateId}/fields`,
                description: 'Get fields from dedicated fields endpoint'
            }
        ];
        
        for (const endpoint of endpoints) {
            console.log(`\n🔍 Trying ${endpoint.name}...`);
            console.log(`📡 ${endpoint.description}`);
            console.log(`🌐 URL: ${endpoint.url}`);
            
            try {
                const response = await axios.get(endpoint.url, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    }
                });
                
                console.log(`✅ ${endpoint.name} successful!`);
                console.log(`📊 Status: ${response.status}`);
                console.log(`📊 Response keys: ${Object.keys(response.data).join(', ')}`);
                
                // Check for fields in different possible locations
                let fields = [];
                if (response.data.fields) {
                    fields = response.data.fields;
                    console.log(`📋 Found ${fields.length} fields in 'fields' property`);
                } else if (response.data.texts) {
                    fields = response.data.texts;
                    console.log(`📋 Found ${fields.length} fields in 'texts' property`);
                } else if (response.data.data && response.data.data.fields) {
                    fields = response.data.data.fields;
                    console.log(`📋 Found ${fields.length} fields in 'data.fields' property`);
                } else if (response.data.data && response.data.data.texts) {
                    fields = response.data.data.texts;
                    console.log(`📋 Found ${fields.length} fields in 'data.texts' property`);
                } else {
                    console.log('📋 No fields found in expected locations');
                    console.log('📊 Full response structure:');
                    console.log(JSON.stringify(response.data, null, 2));
                }
                
                if (fields.length > 0) {
                    console.log('\n📍 Field Details:');
                    console.log('=================');
                    
                    fields.forEach((field, index) => {
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
                    
                    const laborSupportFields = ['client_initials', 'signature_date', 'client_signature', 'client_name'];
                    const foundFields = [];
                    const missingFields = [];
                    
                    laborSupportFields.forEach(requiredField => {
                        const found = fields.find(field => {
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
                    
                    fields.forEach(field => {
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
                    
                    return; // Exit on first successful endpoint
                }
                
            } catch (error) {
                console.log(`❌ ${endpoint.name} failed: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
                if (error.response?.data) {
                    console.log(`📊 Error details: ${JSON.stringify(error.response.data, null, 2)}`);
                }
            }
        }
        
        console.log('\n💡 All API endpoints failed. This could mean:');
        console.log('   1. The template ID is incorrect');
        console.log('   2. The template is not accessible with current credentials');
        console.log('   3. The template is in a different workspace');
        console.log('   4. The template needs to be published/saved properly');
        console.log('   5. The API endpoint structure has changed');
        
    } catch (error) {
        console.error('❌ Error getting template fields:', error.response?.data || error.message);
    }
}

getTemplateFieldsViaAPI();

