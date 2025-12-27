// Use the existing working contract endpoint to send the Labor Support invitation
// This uses the existing working endpoint that's already in the codebase

require('dotenv').config();

async function useExistingEndpoint() {
  try {
    console.log('📧 USING EXISTING WORKING CONTRACT ENDPOINT\n');

    const documentId = '64c10f636ca1402895954c3bd335cf73185ecff8';
    const client = {
      name: 'Jerry Techluminate',
      email: 'jerrybony5@gmail.com'
    };

    console.log('📄 Document ID:', documentId);
    console.log('👤 Client:', client);

    // Use the existing working endpoint
    const response = await fetch('http://localhost:5050/api/contract/postpartum/send-client-invite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        documentId,
        client
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ SUCCESS! Invitation sent using existing endpoint');
      console.log('📧 Response:', JSON.stringify(result, null, 2));
    } else {
      console.error('❌ Error from existing endpoint:', result);
    }

  } catch (error) {
    console.error('❌ Error using existing endpoint:', error.message);
  }
}

// Run the script
useExistingEndpoint();






