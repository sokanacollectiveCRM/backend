require('dotenv').config();
const axios = require('axios');

async function testTemplateCloning(templateId) {
  try {
    console.log('🔍 Testing template cloning with field values...');

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

    // Clone template with field values
    const fieldValues = [
      { field_name: 'Client Name', value: 'John Doe' },
      { field_name: 'Total Amount', value: '$2,500' },
      { field_name: 'Deposit Amount', value: '$500' },
      { field_name: 'Balance Amount', value: '$2,000' },
    ];

    console.log('📋 Cloning template with field values:', fieldValues);

    const response = await axios.post(
      `https://api.signnow.com/document/${templateId}/copy`,
      {
        field_values: fieldValues,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const newDocumentId = response.data.id;
    console.log('✅ Template cloned successfully!');
    console.log(`📄 New document ID: ${newDocumentId}`);

    // Check the cloned document fields
    console.log('🔍 Checking cloned document fields...');
    const docResponse = await axios.get(
      `https://api.signnow.com/document/${newDocumentId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('📋 Cloned document fields:');
    console.log('================================');

    if (docResponse.data.fields && docResponse.data.fields.length > 0) {
      docResponse.data.fields.forEach((field, index) => {
        console.log(`Field ${index + 1}:`);
        console.log(`  Name: ${field.name}`);
        console.log(`  Type: ${field.type}`);
        console.log(`  Label: ${field.label || 'No label'}`);
        console.log(`  Value: ${field.prefilled_text || 'No value'}`);
        console.log(`  Role: ${field.role || 'No role'}`);
        console.log('---');
      });
    } else {
      console.log('❌ No fields found in cloned document');
    }
  } catch (error) {
    console.error('❌ Error testing template cloning:', {
      error: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });
  }
}

// Run the script
const templateId = process.argv[2];
if (!templateId) {
  console.log('Usage: node scripts/testTemplateCloning.js <templateId>');
  console.log(
    'Example: node scripts/testTemplateCloning.js a96cc8ac00f3497f8278badcd86c5f044052974f'
  );
} else {
  testTemplateCloning(templateId);
}






