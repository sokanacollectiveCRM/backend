require('dotenv').config();
const axios = require('axios');

async function checkTemplateStatus() {
  try {
    console.log('🔍 Checking template status and field positions...');

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

    // Get current template status
    const templateResponse = await axios.get(
      `https://api.signnow.com/document/${templateId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('📄 Template status:');
    console.log('Document ID:', templateResponse.data.id);
    console.log('Document name:', templateResponse.data.document_name);
    console.log('Total pages:', templateResponse.data.page_count);
    console.log('Is template:', templateResponse.data.template);

    if (
      templateResponse.data.fields &&
      templateResponse.data.fields.length > 0
    ) {
      console.log('✅ Current fields in template:');
      templateResponse.data.fields.forEach((field, index) => {
        const attrs = field.json_attributes;
        console.log(`Field ${index + 1}:`, {
          name: attrs.name,
          type: field.type,
          page: attrs.page_number,
          position: `(${attrs.x}, ${attrs.y})`,
          size: `${attrs.width}x${attrs.height}`,
          role: field.role,
        });
      });
    } else {
      console.log('❌ No fields found in template');
    }

    // Check if there are any existing fields that might be conflicting
    console.log('\n🔍 Checking for field conflicts...');
    if (templateResponse.data.fields) {
      const signatureFields = templateResponse.data.fields.filter(
        (f) => f.type === 'signature'
      );
      const dateFields = templateResponse.data.fields.filter(
        (f) =>
          f.type === 'text' &&
          f.json_attributes.name &&
          f.json_attributes.name.toLowerCase().includes('date')
      );

      console.log(`Signature fields found: ${signatureFields.length}`);
      console.log(`Date fields found: ${dateFields.length}`);

      if (signatureFields.length > 1) {
        console.log(
          '⚠️ Multiple signature fields detected - this might cause issues'
        );
      }
      if (dateFields.length > 1) {
        console.log(
          '⚠️ Multiple date fields detected - this might cause issues'
        );
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

// Run the script
checkTemplateStatus();






