require('dotenv').config();
const axios = require('axios');

async function recreateFields() {
  try {
    console.log('🔍 Recreating fields in SignNow document...');

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

    // Document ID we're working with
    const documentId = 'cf1fbb83383a42ef9fc3aab4cb44624c4c9fc3c4';

    // First, get the current document to see what fields exist
    const documentResponse = await axios.get(
      `https://api.signnow.com/document/${documentId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('📄 Current document fields:');
    if (
      documentResponse.data.fields &&
      documentResponse.data.fields.length > 0
    ) {
      console.log(`Found ${documentResponse.data.fields.length} fields`);

      // Delete existing fields by setting empty fields array
      console.log('🗑️ Removing existing fields...');
      const deleteResponse = await axios.put(
        `https://api.signnow.com/document/${documentId}`,
        {
          client_timestamp: Math.floor(Date.now() / 1000),
          fields: [],
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('✅ Existing fields removed');
    }

    // Add new fields with proper properties
    console.log('➕ Adding new fields with proper properties...');
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
          width: 120,
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
          width: 120,
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
          width: 120,
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

    console.log('✅ New fields added successfully!');

    // Verify the new fields
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
      console.log('✅ Verification - New fields:');
      verifyResponse.data.fields.forEach((field, index) => {
        console.log(
          `Field ${index + 1}: ${field.name} (${field.type}) at (${field.x}, ${field.y}) - Size: ${field.width}x${field.height}`
        );
      });
    } else {
      console.log('❌ No fields found after recreation');
    }

    // Test sending an invitation
    console.log('📤 Testing invitation sending...');
    const invitationData = {
      to: 'test@example.com',
      from: process.env.SIGNNOW_USERNAME,
      subject: 'Please sign your Labor Support Agreement',
      message:
        'Please review and sign your Labor Support Agreement. The document has been prepared with the necessary fields for completion.',
      redirect_to: 'https://example.com/success',
      decline_redirect_to: 'https://example.com/decline',
    };

    const invitationResponse = await axios.post(
      `https://api.signnow.com/document/${documentId}/invite`,
      invitationData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Invitation sent successfully!');
    console.log('Invitation ID:', invitationResponse.data.id);
  } catch (error) {
    console.error(
      '❌ Error recreating fields:',
      error.response?.data || error.message
    );
  }
}

recreateFields();





