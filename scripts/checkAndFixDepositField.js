require('dotenv').config();
const axios = require('axios');

async function checkAndFixDepositField() {
  try {
    console.log('🔍 Checking and fixing depositAmount field position...');
    
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
    
    // Use the document from our last test
    const documentId = '00c42891a8ff4bddbb74299804af18654202004c';
    console.log('📋 Using document ID:', documentId);
    
    // Check current fields
    console.log('🔍 Getting current document fields...');
    const documentResponse = await axios.get(
      `https://api.signnow.com/document/${documentId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    const fields = documentResponse.data.fields || [];
    console.log('📋 Current fields in document:');
    fields.forEach((field, index) => {
      console.log(`Field ${index + 1}:`);
      console.log(`  Name: ${field.json_attributes?.name || field.name}`);
      console.log(`  Type: ${field.type}`);
      console.log(`  Position: (${field.json_attributes?.x}, ${field.json_attributes?.y})`);
      console.log(`  Value: ${field.prefilled_text || field.data || 'No value'}`);
      console.log('---');
    });
    
    // Add depositAmount field at better coordinates
    // Based on the contract text, it should be positioned where the {depositAmount} placeholder appears
    console.log('🔧 Adding depositAmount field at correct position...');
    const fieldData = {
      client_timestamp: Math.floor(Date.now() / 1000),
      fields: [
        {
          page_number: 1,
          type: 'text',
          name: 'depositAmount',
          role: 'Signer 1',
          required: true,
          height: 25,
          width: 100,
          x: 150, // Adjusted to be more visible
          y: 300, // Adjusted to be more visible
          label: 'Deposit Amount',
          prefilled_text: '$600.00'
        }
      ]
    };
    
    await axios.put(
      `https://api.signnow.com/document/${documentId}`,
      fieldData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    console.log('✅ Deposit amount field added at corrected position');
    console.log('🌐 Document URL: https://app.signnow.com/webapp/document/' + documentId);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

checkAndFixDepositField();






