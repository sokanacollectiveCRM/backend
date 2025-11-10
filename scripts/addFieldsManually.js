require('dotenv').config();
const axios = require('axios');

async function addFieldsManually(documentId) {
  try {
    console.log('🔍 Adding fields manually to SignNow document...');

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

    // Add fields manually
    const fieldData = {
      client_timestamp: Math.floor(Date.now() / 1000),
      fields: [
        {
          page_number: 1,
          type: 'text',
          name: 'Total Amount',
          role: 'Signer 1',
          required: true,
          height: 25,
          width: 100,
          x: 300,
          y: 400,
          label: 'Total Amount',
        },
        {
          page_number: 1,
          type: 'text',
          name: 'Deposit Amount',
          role: 'Signer 1',
          required: true,
          height: 25,
          width: 100,
          x: 300,
          y: 450,
          label: 'Deposit Amount',
        },
        {
          page_number: 1,
          type: 'text',
          name: 'Balance Amount',
          role: 'Signer 1',
          required: true,
          height: 25,
          width: 100,
          x: 300,
          y: 500,
          label: 'Balance Amount',
        },
        {
          page_number: 1,
          type: 'text',
          name: 'Client Name',
          role: 'Signer 1',
          required: true,
          height: 25,
          width: 200,
          x: 300,
          y: 550,
          label: 'Client Name',
        },
        {
          page_number: 1,
          type: 'text',
          name: 'Initials',
          role: 'Signer 1',
          required: true,
          height: 25,
          width: 100,
          x: 300,
          y: 600,
          label: 'Initials',
        },
        {
          page_number: 1,
          type: 'signature',
          name: 'Signature',
          role: 'Signer 1',
          required: true,
          height: 50,
          width: 200,
          x: 300,
          y: 650,
        },
        {
          page_number: 1,
          type: 'text',
          name: 'Date',
          role: 'Signer 1',
          required: true,
          height: 25,
          width: 150,
          x: 500,
          y: 650,
          label: 'Date',
        },
      ],
    };

    const response = await axios.put(
      `https://api.signnow.com/document/${documentId}`,
      fieldData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Fields added successfully!');
    console.log('Response:', response.data);

    // Verify fields were added
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
      console.log('✅ Verification: Fields found in document:');
      verifyResponse.data.fields.forEach((field, index) => {
        console.log(
          `Field ${index + 1}: ${field.name} (${field.type}) at (${field.x}, ${field.y})`
        );
      });
    }
  } catch (error) {
    console.error(
      '❌ Error adding fields:',
      error.response?.data || error.message
    );
  }
}

// Use the latest document ID
const documentId = 'cf1fbb83383a42ef9fc3aab4cb44624c4c9fc3c4';
addFieldsManually(documentId);
