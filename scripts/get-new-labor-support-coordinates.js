const axios = require('axios');

async function getNewLaborSupportCoordinates() {
  console.log('🔍 Getting New Labor Support Contract Field Coordinates');
  console.log('📋 Document: https://app.signnow.com/webapp/document/f882b50d3ac84415b9e91f5c40dd709b3fbe7b17');
  console.log('');

  try {
    // SignNow authentication
    console.log('🔐 Testing SignNow authentication...');
    const authResponse = await axios.post('https://api.signnow.com/oauth2/token', {
      grant_type: 'password',
      client_id: process.env.SIGNNOW_CLIENT_ID,
      client_secret: process.env.SIGNNOW_CLIENT_SECRET,
      username: process.env.SIGNNOW_USERNAME,
      password: process.env.SIGNNOW_PASSWORD
    });

    if (authResponse.data.access_token) {
      console.log('✅ SignNow authentication successful');
    } else {
      throw new Error('Authentication failed');
    }

    const accessToken = authResponse.data.access_token;

    // Get document fields
    console.log('📋 Getting document fields...');
    const documentId = 'f882b50d3ac84415b9e91f5c40dd709b3fbe7b17';

    const response = await axios.get(`https://api.signnow.com/document/${documentId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Document fields retrieved successfully');

    // Extract field coordinates
    const fields = response.data.fields || [];
    console.log('🎯 Field Coordinates for Labor Support Contract:');
    console.log('💡 Use these coordinates to update the SignNow field positioning in the code');
    console.log('');

    fields.forEach((field, index) => {
      const attrs = field.json_attributes;
      if (attrs) {
        console.log(`${index + 1}. ${field.type.toUpperCase()} - ${attrs.name || 'Unnamed'}:`);
        console.log(`   Page: ${attrs.page_number}`);
        console.log(`   Position: x=${attrs.x}, y=${attrs.y}`);
        console.log(`   Size: width=${attrs.width}, height=${attrs.height}`);
        console.log(`   Required: ${attrs.required}`);
        console.log('');
      }
    });

    // Summary of key coordinates
    const signatureFields = fields.filter(f => f.type === 'signature');
    const dateFields = fields.filter(f => f.type === 'text' && f.json_attributes?.name?.toLowerCase().includes('date'));
    const initialsFields = fields.filter(f => f.type === 'initials');

    console.log('📊 Summary of Key Fields:');
    console.log('========================');

    if (signatureFields.length > 0) {
      const sig = signatureFields[0].json_attributes;
      console.log(`🔏 Signature: Page ${sig.page_number}, x=${sig.x}, y=${sig.y}`);
    }

    if (dateFields.length > 0) {
      const date = dateFields[0].json_attributes;
      console.log(`📅 Date: Page ${date.page_number}, x=${date.x}, y=${date.y}`);
    }

    if (initialsFields.length > 0) {
      console.log('✍️ Initials Fields:');
      initialsFields.forEach((field, i) => {
        const attrs = field.json_attributes;
        console.log(`   ${i + 1}. Page ${attrs.page_number}, x=${attrs.x}, y=${attrs.y} (${attrs.name})`);
      });
    }

  } catch (error) {
    console.log('❌ Error getting document fields:', error.response?.data || error.message);
  }
}

getNewLaborSupportCoordinates();
