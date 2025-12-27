require('dotenv').config();
const axios = require('axios');

async function testPrefillFields() {
  try {
    console.log('🔍 Testing field prefill...');

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

    // Get document fields first
    const documentId = 'cf1fbb83383a42ef9fc3aab4cb44624c4c9fc3c4';
    const documentResponse = await axios.get(
      `https://api.signnow.com/document/${documentId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('📄 Document fields:');
    if (
      documentResponse.data.fields &&
      documentResponse.data.fields.length > 0
    ) {
      documentResponse.data.fields.forEach((field, index) => {
        console.log(
          `Field ${index + 1}: ${field.name || 'Unnamed'} (${field.type}) at (${field.x}, ${field.y})`
        );
      });
    } else {
      console.log('❌ No fields found in document');
      return;
    }

    // Try to prefill fields
    const prefillData = {
      client_timestamp: Math.floor(Date.now() / 1000),
      fields: documentResponse.data.fields.map((field) => ({
        ...field,
        prefilled_text: getPrefillValue(field.name || field.type),
      })),
    };

    console.log('📋 Attempting to prefill fields...');

    const prefillResponse = await axios.put(
      `https://api.signnow.com/document/${documentId}`,
      prefillData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Fields prefilled successfully!');
    console.log('Response:', prefillResponse.data);

    // Verify prefilled values
    const verifyResponse = await axios.get(
      `https://api.signnow.com/document/${documentId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (verifyResponse.data.fields && verifyResponse.data.fields.length > 0) {
      console.log('✅ Verification - Prefilled fields:');
      verifyResponse.data.fields.forEach((field, index) => {
        console.log(
          `Field ${index + 1}: ${field.name || 'Unnamed'} - Value: ${field.prefilled_text || 'Not prefilled'}`
        );
      });
    }
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

function getPrefillValue(fieldName) {
  const prefillMap = {
    'Client Name': 'John Doe',
    'Total Amount': '$2,500',
    'Deposit Amount': '$500',
    'Balance Amount': '$2,000',
    Date: new Date().toLocaleDateString(),
    Initials: 'JD',
  };

  return prefillMap[fieldName] || 'Sample Value';
}

testPrefillFields();






