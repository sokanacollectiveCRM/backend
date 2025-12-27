require('dotenv').config();
const axios = require('axios');

async function sendSigningInvitation() {
  try {
    console.log('🔍 Sending signing invitation...');

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

    // Send invitation
    const documentId = 'cf1fbb83383a42ef9fc3aab4cb44624c4c9fc3c4';

    const invitationData = {
      to: 'test@example.com',
      from: process.env.SIGNNOW_USERNAME,
      subject: 'Please sign your Labor Support Agreement',
      message:
        'Please review and sign your Labor Support Agreement. The document has been prepared with the necessary fields for completion.',
      redirect_to: 'https://example.com/success',
      decline_redirect_to: 'https://example.com/decline',
    };

    console.log('📤 Sending invitation with data:', invitationData);

    const response = await axios.post(
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
    console.log('Invitation ID:', response.data.id);
    console.log('Response:', response.data);
  } catch (error) {
    console.error(
      '❌ Error sending invitation:',
      error.response?.data || error.message
    );
  }
}

sendSigningInvitation();






