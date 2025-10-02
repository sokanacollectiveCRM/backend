const axios = require('axios');
require('dotenv').config();

async function getCoordinates() {
  console.log('🔍 Getting Labor Support Field Coordinates');
  console.log('📋 Document: https://app.signnow.com/webapp/document/b5ab4f5b513e4dfe8ddf30d752cc832acf679a59');
  console.log('');

  try {
    // Use environment variables from .env file
    const authData = {
      grant_type: 'password',
      client_id: process.env.SIGNNOW_CLIENT_ID,
      client_secret: process.env.SIGNNOW_CLIENT_SECRET,
      username: process.env.SIGNNOW_USERNAME,
      password: process.env.SIGNNOW_PASSWORD
    };

    console.log('🔐 Authenticating with SignNow...');
    const authResponse = await axios.post('https://api.signnow.com/oauth2/token', authData);

    if (!authResponse.data.access_token) {
      throw new Error('No access token received');
    }

    console.log('✅ Authentication successful');

    const accessToken = authResponse.data.access_token;
    const documentId = 'b5ab4f5b513e4dfe8ddf30d752cc832acf679a59';

    console.log('📋 Getting document fields...');
    const response = await axios.get(`https://api.signnow.com/document/${documentId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Document retrieved successfully');

    const fields = response.data.fields || [];
    console.log(`📊 Found ${fields.length} fields`);
    console.log('');

    // Extract and display field coordinates
    console.log('🎯 Field Coordinates for Labor Support Contract:');
    console.log('================================================');

    fields.forEach((field, index) => {
      const attrs = field.json_attributes;
      if (attrs) {
        console.log(`${index + 1}. ${field.type.toUpperCase()} - "${attrs.name || 'Unnamed'}":`);
        console.log(`   Page: ${attrs.page_number}`);
        console.log(`   Position: x=${attrs.x}, y=${attrs.y}`);
        console.log(`   Size: ${attrs.width}x${attrs.height}`);
        console.log(`   Required: ${attrs.required}`);
        console.log('');
      }
    });

    // Summary of key field types
    const signatureFields = fields.filter(f => f.type === 'signature');
    const dateFields = fields.filter(f => f.type === 'text' && f.json_attributes?.name?.toLowerCase().includes('date'));
    const initialsFields = fields.filter(f => f.type === 'initials');

    console.log('📊 Summary for Code Update:');
    console.log('===========================');

    if (signatureFields.length > 0) {
      const sig = signatureFields[0].json_attributes;
      console.log(`🔏 Signature: x=${sig.x}, y=${sig.y} (Page ${sig.page_number})`);
    }

    if (dateFields.length > 0) {
      const date = dateFields[0].json_attributes;
      console.log(`📅 Date: x=${date.x}, y=${date.y} (Page ${date.page_number})`);
    }

    if (initialsFields.length > 0) {
      console.log('✍️ Initials Fields:');
      initialsFields.forEach((field, i) => {
        const attrs = field.json_attributes;
        console.log(`   ${i + 1}. x=${attrs.x}, y=${attrs.y} (Page ${attrs.page_number}) - ${attrs.name}`);
      });
    }

  } catch (error) {
    console.log('❌ Error:', error.response?.data || error.message);
  }
}

getCoordinates();
