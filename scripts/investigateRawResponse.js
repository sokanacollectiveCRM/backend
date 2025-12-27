require('dotenv').config();
const axios = require('axios');

async function investigateRawResponse() {
  try {
    console.log('🔍 Investigating raw SignNow API response...');

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

    // Get the raw response
    const response = await axios.get(
      `https://api.signnow.com/document/${templateId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('📄 Raw API Response:');
    console.log('==================');
    console.log(JSON.stringify(response.data, null, 2));

    // Check if fields exist and their structure
    if (response.data.fields) {
      console.log('\n🔍 Fields Analysis:');
      console.log('==================');
      console.log('Fields type:', typeof response.data.fields);
      console.log('Fields is array:', Array.isArray(response.data.fields));
      console.log('Fields length:', response.data.fields.length);

      if (response.data.fields.length > 0) {
        console.log('\nFirst field analysis:');
        const firstField = response.data.fields[0];
        console.log('Field keys:', Object.keys(firstField));
        console.log('Field values:', Object.values(firstField));
        console.log('Field x:', firstField.x);
        console.log('Field y:', firstField.y);
        console.log('Field width:', firstField.width);
        console.log('Field height:', firstField.height);
        console.log('Field page_number:', firstField.page_number);
        console.log('Field type:', firstField.type);
        console.log('Field name:', firstField.name);
        console.log('Field role:', firstField.role);
      }
    } else {
      console.log('❌ No fields property in response');
    }

    // Check for alternative field properties
    console.log('\n🔍 Looking for alternative field properties:');
    console.log('==========================================');
    const responseKeys = Object.keys(response.data);
    console.log('Response keys:', responseKeys);

    // Look for any property that might contain field information
    responseKeys.forEach((key) => {
      if (
        key.toLowerCase().includes('field') ||
        key.toLowerCase().includes('element')
      ) {
        console.log(
          `Found potential field property: ${key}`,
          response.data[key]
        );
      }
    });
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

// Run the script
investigateRawResponse();






