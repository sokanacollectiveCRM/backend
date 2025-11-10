require('dotenv').config();
const axios = require('axios');

async function testTemplateCloningWithFields() {
  try {
    console.log('🔍 Testing template cloning with field values...');

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

    // Clone the document with field values
    const documentId = 'cf1fbb83383a42ef9fc3aab4cb44624c4c9fc3c4';
    const fieldValues = [
      { field_name: 'Client Name', value: 'John Doe' },
      { field_name: 'Total Amount', value: '$2,500' },
      { field_name: 'Deposit Amount', value: '$500' },
      { field_name: 'Balance Amount', value: '$2,000' },
      { field_name: 'Date', value: new Date().toLocaleDateString() },
      { field_name: 'Initials', value: 'JD' },
    ];

    console.log('📋 Cloning document with field values:', fieldValues);

    const cloneResponse = await axios.post(
      `https://api.signnow.com/document/${documentId}/copy`,
      {
        field_values: fieldValues,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Document cloned successfully!');
    console.log('New document ID:', cloneResponse.data.id);

    // Check the cloned document
    const verifyResponse = await axios.get(
      `https://api.signnow.com/document/${cloneResponse.data.id}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (verifyResponse.data.fields && verifyResponse.data.fields.length > 0) {
      console.log('✅ Cloned document fields:');
      verifyResponse.data.fields.forEach((field, index) => {
        console.log(
          `Field ${index + 1}: ${field.name} (${field.type}) - Value: ${field.prefilled_text || 'Not prefilled'}`
        );
      });
    } else {
      console.log('❌ No fields found in cloned document');
    }

    // Send invitation for signing
    console.log('📤 Sending invitation for signing...');
    const invitationResponse = await axios.post(
      `https://api.signnow.com/document/${cloneResponse.data.id}/invite`,
      {
        to: 'test@example.com',
        from: process.env.SIGNNOW_USERNAME,
        subject: 'Please sign your Labor Support Agreement',
        message:
          'Please review and sign your Labor Support Agreement. The fields have been prefilled with your information.',
        redirect_to: 'https://example.com/success',
        decline_redirect_to: 'https://example.com/decline',
      },
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
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testTemplateCloningWithFields();





