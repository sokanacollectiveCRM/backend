require('dotenv').config();
const axios = require('axios');

async function checkTemplateFields(templateId) {
  try {
    console.log('🔍 Checking template fields in SignNow...');

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

    // Get template fields
    const response = await axios.get(
      `https://api.signnow.com/document/${templateId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('📋 Template fields found:');
    console.log('================================');

    if (response.data.fields && response.data.fields.length > 0) {
      response.data.fields.forEach((field, index) => {
        console.log(`Field ${index + 1}:`);
        console.log(`  Name: ${field.name}`);
        console.log(`  Type: ${field.type}`);
        console.log(`  Label: ${field.label || 'No label'}`);
        console.log(`  Role: ${field.role || 'No role'}`);
        console.log(`  Required: ${field.required}`);
        console.log(`  Page: ${field.page_number}`);
        console.log(`  Position: (${field.x}, ${field.y})`);
        console.log('---');
      });
    } else {
      console.log('❌ No fields found in template');
    }
  } catch (error) {
    console.error('❌ Error checking template fields:', {
      error: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });
  }
}

// Run the script
const templateId = process.argv[2];
if (!templateId) {
  console.log('Usage: node scripts/checkTemplateFields.js <templateId>');
  console.log(
    'Example: node scripts/checkTemplateFields.js a96cc8ac00f3497f8278badcd86c5f044052974f'
  );
} else {
  checkTemplateFields(templateId);
}





