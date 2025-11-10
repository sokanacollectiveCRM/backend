require('dotenv').config();
const axios = require('axios');

async function debugSignNowFields() {
  try {
    console.log('🔍 Debugging SignNow field information...');

    // Get auth token
    const authResponse = await axios.post(
      'https://api.signnow.com/oauth2/token',
      {
        grant_type: 'password',
        client_id: process.env.SIGNNOW_CLIENT_ID,
        client_secret: process.env.SIGNNOW_CLIENT_SECRET,
        username: process.env.SIGNNOW_USERNAME,
        password: process.env.SIGNNOW_PASSWORD,
      }
    );

    const token = authResponse.data.access_token;
    console.log('✅ Authenticated with SignNow');

    // Template document ID
    const templateId = '6af732001d7944ee83cb6dde81846c3e83c241d8';
    
    // Try different API endpoints to get field information
    console.log('🔍 Trying different API endpoints...');
    
    // 1. Standard document endpoint
    console.log('\n1. Standard document endpoint:');
    const documentResponse = await axios.get(
      `https://api.signnow.com/document/${templateId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    console.log('Document response keys:', Object.keys(documentResponse.data));
    console.log('Fields array:', documentResponse.data.fields);
    console.log('Fields length:', documentResponse.data.fields ? documentResponse.data.fields.length : 'No fields array');
    
    if (documentResponse.data.fields && documentResponse.data.fields.length > 0) {
      console.log('First field full object:', JSON.stringify(documentResponse.data.fields[0], null, 2));
    }
    
    // 2. Try document fields endpoint
    console.log('\n2. Document fields endpoint:');
    try {
      const fieldsResponse = await axios.get(
        `https://api.signnow.com/document/${templateId}/fields`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      console.log('Fields endpoint response:', fieldsResponse.data);
    } catch (error) {
      console.log('Fields endpoint error:', error.response?.data || error.message);
    }
    
    // 3. Try document details endpoint
    console.log('\n3. Document details endpoint:');
    try {
      const detailsResponse = await axios.get(
        `https://api.signnow.com/document/${templateId}/details`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      console.log('Details endpoint response:', detailsResponse.data);
    } catch (error) {
      console.log('Details endpoint error:', error.response?.data || error.message);
    }
    
    // 4. Try document info endpoint
    console.log('\n4. Document info endpoint:');
    try {
      const infoResponse = await axios.get(
        `https://api.signnow.com/document/${templateId}/info`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      console.log('Info endpoint response:', infoResponse.data);
    } catch (error) {
      console.log('Info endpoint error:', error.response?.data || error.message);
    }

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

// Run the script
debugSignNowFields();





