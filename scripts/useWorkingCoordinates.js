require('dotenv').config();
const axios = require('axios');

async function useWorkingCoordinates() {
  try {
    console.log('🔍 Using working coordinates from existing system...');

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

    // Use the working coordinates from your existing system
    const workingCoordinates = {
      signature: { x: 100, y: 200, width: 200, height: 60, page: 3 },
      name: { x: 100, y: 280, width: 250, height: 30, page: 3 },
      date: { x: 100, y: 330, width: 120, height: 30, page: 3 },
    };

    console.log('📋 Working coordinates from existing system:');
    console.log('============================================');
    console.log('Signature field:', workingCoordinates.signature);
    console.log('Name field:', workingCoordinates.name);
    console.log('Date field:', workingCoordinates.date);

    // Create a new document and add fields with these coordinates
    console.log('📤 Creating new document with working coordinates...');

    // For now, let's use the template we already have
    const templateId = '6af732001d7944ee83cb6dde81846c3e83c241d8';

    // Add fields with the working coordinates
    const fieldData = {
      client_timestamp: Math.floor(Date.now() / 1000),
      fields: [
        {
          page_number: workingCoordinates.signature.page,
          type: 'signature',
          name: 'Client Signature',
          role: 'Signer 1',
          required: true,
          height: workingCoordinates.signature.height,
          width: workingCoordinates.signature.width,
          x: workingCoordinates.signature.x,
          y: workingCoordinates.signature.y,
        },
        {
          page_number: workingCoordinates.name.page,
          type: 'text',
          name: 'Client Name',
          role: 'Signer 1',
          required: true,
          height: workingCoordinates.name.height,
          width: workingCoordinates.name.width,
          x: workingCoordinates.name.x,
          y: workingCoordinates.name.y,
          label: 'Client Name (Printed)',
        },
        {
          page_number: workingCoordinates.date.page,
          type: 'text',
          name: 'Date',
          role: 'Signer 1',
          required: true,
          height: workingCoordinates.date.height,
          width: workingCoordinates.date.width,
          x: workingCoordinates.date.x,
          y: workingCoordinates.date.y,
          label: 'Date',
        },
      ],
    };

    const fieldResponse = await axios.put(
      `https://api.signnow.com/document/${templateId}`,
      fieldData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Fields added with working coordinates');

    // Verify the fields were added
    const verifyResponse = await axios.get(
      `https://api.signnow.com/document/${templateId}`,
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
      `https://api.signnow.com/document/${templateId}/invite`,
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
    console.log('Document ID:', templateId);
    console.log(
      'SignNow URL:',
      `https://app.signnow.com/webapp/document/${templateId}`
    );

    return {
      success: true,
      templateId,
      invitationId: invitationResponse.data.id,
      coordinates: workingCoordinates,
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
useWorkingCoordinates().then((result) => {
  if (result.success) {
    console.log('\n🎉 Successfully used working coordinates!');
    console.log('📋 Summary:');
    console.log(`- Template ID: ${result.templateId}`);
    console.log(`- Invitation ID: ${result.invitationId}`);
    console.log(
      '✅ These coordinates work and can be used in your contract generation system'
    );
  } else {
    console.log('\n❌ Failed to use working coordinates');
    console.log('Error:', result.error);
  }
});





