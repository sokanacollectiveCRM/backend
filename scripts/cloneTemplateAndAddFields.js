require('dotenv').config();
const axios = require('axios');

async function cloneTemplateAndAddFields() {
  try {
    console.log('🔍 Cloning template and adding properly positioned fields...');

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

    // Clone the template
    console.log('📋 Cloning template...');
    const cloneResponse = await axios.post(
      `https://api.signnow.com/document/${templateId}/copy`,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const documentId = cloneResponse.data.id;
    console.log(`✅ Template cloned. New document ID: ${documentId}`);

    // Add properly positioned fields with coordinates
    console.log('🔧 Adding fields with proper coordinates...');
    const fieldData = {
      client_timestamp: Math.floor(Date.now() / 1000),
      fields: [
        {
          page_number: 1,
          type: 'signature',
          name: 'Client Signature',
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
      ],
    };

    const fieldResponse = await axios.put(
      `https://api.signnow.com/document/${documentId}`,
      fieldData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Fields added successfully');

    // Verify the fields were added with coordinates
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
      console.log('✅ Verification - Fields with coordinates:');
      verifyResponse.data.fields.forEach((field, index) => {
        console.log(`Field ${index + 1}:`, {
          name: field.name,
          type: field.type,
          page: field.page_number,
          position: `(${field.x}, ${field.y})`,
          size: `${field.width}x${field.height}`,
          role: field.role,
        });
      });
    }

    // Prefill the date field
    console.log('📝 Prefilling date field...');
    const prefillData = {
      client_timestamp: Math.floor(Date.now() / 1000),
      fields: [
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
          prefilled_text: new Date().toLocaleDateString(),
        },
      ],
    };

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

    console.log('✅ Date field prefilled');

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
    console.log('Document ID:', documentId);
    console.log(
      'SignNow URL:',
      `https://app.signnow.com/webapp/document/${documentId}`
    );

    return {
      success: true,
      documentId,
      invitationId: invitationResponse.data.id,
    };
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data || error.message,
    };
  }
}

// Run the script
cloneTemplateAndAddFields().then((result) => {
  if (result.success) {
    console.log(
      '\n🎉 Template cloning and field addition completed successfully!'
    );
    console.log('📋 Summary:');
    console.log(`- Document ID: ${result.documentId}`);
    console.log(`- Invitation ID: ${result.invitationId}`);
    console.log(
      `- SignNow URL: https://app.signnow.com/webapp/document/${result.documentId}`
    );
  } else {
    console.log('\n❌ Template cloning failed');
    console.log('Error:', result.error);
  }
});
