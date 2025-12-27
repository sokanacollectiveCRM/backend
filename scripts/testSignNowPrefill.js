require('dotenv').config();
const axios = require('axios');

async function testSignNowPrefill() {
  try {
    console.log('🔍 Testing SignNow prefill API with template...');
    
    // First authenticate
    const authResponse = await axios.post(
      'https://api.signnow.com/oauth2/token',
      new URLSearchParams({
        grant_type: 'password',
        client_id: process.env.SIGNNOW_CLIENT_ID,
        client_secret: process.env.SIGNNOW_CLIENT_SECRET,
        username: process.env.SIGNNOW_USERNAME,
        password: process.env.SIGNNOW_PASSWORD,
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    
    const token = authResponse.data.access_token;
    console.log('✅ Authentication successful');
    
    // Use the template ID from environment
    const templateId = process.env.SIGNNOW_TEMPLATE_ID || '3cc4323f75af4986b9a142513185d2b13d300759';
    console.log('📋 Using template ID:', templateId);
    
    // Prepare field values for prefilling
    const fieldValues = [
      { field_name: 'client_name', value: 'Jerry Techluminate' },
      { field_name: 'total_amount', value: '$1,200.00' },
      { field_name: 'deposit_amount', value: '$600.00' },
      { field_name: 'balance_amount', value: '$600.00' },
      { field_name: 'client_initials', value: 'JT' },
      { field_name: 'client_intials', value: 'JT' }, // Note: template has typo "intials"
      { field_name: 'client_signed_date', value: new Date().toLocaleDateString() }
    ];
    
    console.log('📋 Field values for prefilling:', JSON.stringify(fieldValues, null, 2));
    
    // Clone template with prefilled data
    console.log('📄 Cloning template with prefilled data...');
    const clonePayload = {
      document_name: 'Labor Support Contract - Jerry Techluminate',
      field_values: fieldValues
    };
    
    const cloneResponse = await axios.post(
      `https://api.signnow.com/document/${templateId}/copy`,
      clonePayload,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    const documentId = cloneResponse.data.id;
    console.log('✅ Template cloned successfully:', documentId);
    console.log('🌐 Document URL: https://app.signnow.com/webapp/document/' + documentId);
    
    // Verify the field values were prefilled
    console.log('🔍 Verifying prefilled field values...');
    const verifyResponse = await axios.get(
      `https://api.signnow.com/document/${documentId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    const fields = verifyResponse.data.fields || [];
    console.log('📋 Document fields after prefilling:');
    fields.forEach((field, index) => {
      console.log(`Field ${index + 1}:`);
      console.log(`  Name: ${field.json_attributes?.name || field.name}`);
      console.log(`  Type: ${field.type}`);
      console.log(`  Value: ${field.prefilled_text || field.data || 'No value'}`);
      console.log(`  Position: (${field.json_attributes?.x}, ${field.json_attributes?.y})`);
      console.log('---');
    });
    
    // Send invitation
    console.log('📧 Sending signing invitation...');
    const invitePayload = {
      to: [
        {
          email: 'jerrybony5@gmail.com',
          role: 'Signer 1',
          order: 1,
        },
      ],
      from: 'jerry@techluminateacademy.com',
      redirect_uri: 'https://jerrybony.me/payment?contract_id=test-prefill',
      decline_redirect_uri: 'https://jerrybony.me/',
    };
    
    const inviteResponse = await axios.post(
      `https://api.signnow.com/document/${documentId}/invite`,
      invitePayload,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    console.log('✅ Invitation sent successfully');
    console.log('🎉 SignNow prefill test completed!');
    console.log('📋 Document ID:', documentId);
    console.log('🌐 SignNow URL: https://app.signnow.com/webapp/document/' + documentId);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testSignNowPrefill();






