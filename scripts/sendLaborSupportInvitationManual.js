// Send Labor Support Contract invitation manually using direct API calls
// This bypasses the service layer issues

require('dotenv').config();
const axios = require('axios');

async function sendLaborSupportInvitationManual() {
  try {
    console.log('📧 SENDING LABOR SUPPORT CONTRACT INVITATION - MANUAL METHOD\n');

    // 1️⃣ Get authentication token
    console.log('🔐 Getting SignNow authentication token...');
    
    const authResponse = await axios.post('https://api.signnow.com/oauth2/token', 
      new URLSearchParams({
        grant_type: 'password',
        client_id: process.env.SIGNNOW_CLIENT_ID,
        client_secret: process.env.SIGNNOW_CLIENT_SECRET,
        username: process.env.SIGNNOW_USERNAME,
        password: process.env.SIGNNOW_PASSWORD
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    const token = authResponse.data.access_token;
    console.log('✅ Authentication successful');

    // 2️⃣ Use the document ID from the last successful upload
    const documentId = '64c10f636ca1402895954c3bd335cf73185ecff8';
    console.log(`📄 Using Document ID: ${documentId}`);

    // 3️⃣ Get document details to find the correct role
    console.log('📋 Getting document details...');
    const docResponse = await axios.get(`https://api.signnow.com/document/${documentId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const docData = docResponse.data;
    console.log('📋 Document roles:', docData.roles);
    console.log('📋 Document fields:', docData.fields?.length || 0, 'fields');

    // 4️⃣ Find the correct role ID
    const signerRole = docData.roles?.find(role => role.name === 'Signer 1');
    if (!signerRole) {
      throw new Error('Could not find Signer 1 role in document');
    }
    
    console.log('✅ Found Signer 1 role:', signerRole.unique_id);

    // 5️⃣ Create the invitation
    console.log('📧 Creating signing invitation...');
    
    const invitationData = {
      from: 'jerry@techluminateacademy.com',
      to: [{
        email: 'jerrybony5@gmail.com',
        role_id: signerRole.unique_id,
        order: 1
      }],
      subject: 'Please sign your Labor Support Contract',
      message: 'Please review and sign your Labor Support Contract. Thank you!'
    };

    console.log('📧 Sending invitation with data:', JSON.stringify(invitationData, null, 2));

    const inviteResponse = await axios.post(
      `https://api.signnow.com/document/${documentId}/invite`,
      invitationData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Signing invitation created successfully!');
    console.log('📧 Invitation response:', inviteResponse.data);

    console.log('\n🎉 LABOR SUPPORT CONTRACT INVITATION SENT SUCCESSFULLY!');
    console.log('\n📋 Summary:');
    console.log(`   📄 Document ID: ${documentId}`);
    console.log(`   📧 Invitation sent to: jerrybony5@gmail.com`);
    console.log(`   ✍️ Role used: ${signerRole.name} (${signerRole.unique_id})`);
    console.log(`   📧 Invitation ID: ${inviteResponse.data.id || 'N/A'}`);

    console.log('\n💡 Next Steps:');
    console.log('1. ✅ Labor Support contract invitation sent successfully');
    console.log('2. 📧 Check jerrybony5@gmail.com for the signing invitation');
    console.log('3. ✍️ Click the link in the email to sign the contract');
    console.log('4. 📄 Download the signed contract after signing');

    return {
      documentId,
      invitationId: inviteResponse.data.id,
      success: true
    };

  } catch (error) {
    console.error('❌ Error sending Labor Support invitation:', error.response?.data || error.message);
    throw error;
  }
}

// Run the invitation
sendLaborSupportInvitationManual().catch(console.error);






