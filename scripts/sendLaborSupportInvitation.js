// Send Labor Support Contract invitation manually
// This bypasses the role issue by using the correct role name

require('dotenv').config();
const SignNowService = require('../src/services/signNowService');

async function sendLaborSupportInvitation() {
  try {
    console.log('📧 SENDING LABOR SUPPORT CONTRACT INVITATION\n');

    // 1️⃣ Initialize the SignNow service
    const signNowService = new SignNowService();
    console.log('✅ SignNow service initialized');

    // 2️⃣ Test authentication
    console.log('🔐 Testing SignNow authentication...');
    const authResult = await signNowService.testAuthentication();
    console.log('✅ Authentication successful');

    // 3️⃣ Use the document ID from the last successful upload
    // You can find this in the previous output: 64c10f636ca1402895954c3bd335cf73185ecff8
    const documentId = '64c10f636ca1402895954c3bd335cf73185ecff8';
    console.log(`📄 Using Document ID: ${documentId}`);

    // 4️⃣ Create a simple invitation using the basic invite method
    console.log('📧 Creating signing invitation...');
    
    try {
      // First, let's try to create an invitation using the basic method
      const invitationResult = await signNowService.createSigningInvitation(
        documentId,
        'jerrybony5@gmail.com',
        'Jerry Techluminate',
        'labor-support-001'
      );
      
      console.log('✅ Signing invitation created successfully');
      console.log(`📧 Invitation ID: ${invitationResult.invitationId}`);
      console.log(`🔗 Signing URL: ${invitationResult.signingUrl}`);
      
      return {
        documentId,
        invitationId: invitationResult.invitationId,
        signingUrl: invitationResult.signingUrl,
        success: true
      };
      
    } catch (inviteError) {
      console.error('❌ Failed to create invitation:', inviteError.message);
      
      // If that fails, let's try the embedded method
      console.log('🔄 Trying embedded invitation method...');
      
      try {
        const embeddedResult = await signNowService.createEmbeddedInviteLink(
          documentId,
          { email: 'jerrybony5@gmail.com', name: 'Jerry Techluminate' },
          { 
            roleName: 'Signer 1',
            expiresIn: 60,
            auth_method: 'none' // Try without auth method
          }
        );
        
        console.log('✅ Embedded signing link created successfully');
        console.log(`🔗 Signing Link: ${embeddedResult.link}`);
        console.log(`📧 Invitation ID: ${embeddedResult.inviteId}`);
        
        return {
          documentId,
          signingLink: embeddedResult.link,
          invitationId: embeddedResult.inviteId,
          success: true
        };
        
      } catch (embeddedError) {
        console.error('❌ Embedded invitation also failed:', embeddedError.message);
        throw new Error('Both invitation methods failed');
      }
    }

  } catch (error) {
    console.error('❌ Error sending Labor Support invitation:', error);
    throw error;
  }
}

// Run the invitation
sendLaborSupportInvitation().catch(console.error);






