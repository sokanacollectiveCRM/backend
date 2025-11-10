require('dotenv').config();
const axios = require('axios');

async function checkDocumentFields() {
  try {
    console.log('🔍 Checking document fields...');

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

    // Check the latest document
    const documentId = 'd1f6f8d45e8148d7827bb7d0ce1f3e936f41c80a';
    
    const response = await axios.get(
      `https://api.signnow.com/document/${documentId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('📄 Document details:');
    console.log('Document ID:', response.data.id);
    console.log('Document name:', response.data.document_name);
    console.log('Pages:', response.data.page_count);
    
    if (response.data.fields && response.data.fields.length > 0) {
      console.log('✅ Fields found:');
      response.data.fields.forEach((field, index) => {
        console.log(`Field ${index + 1}:`, {
          name: field.name,
          type: field.type,
          page: field.page_number,
          position: `(${field.x}, ${field.y})`,
          size: `${field.width}x${field.height}`,
          role: field.role,
          required: field.required,
          prefilled_text: field.prefilled_text
        });
      });
    } else {
      console.log('❌ No fields found in document');
    }

  } catch (error) {
    console.error('❌ Error checking document:', error.response?.data || error.message);
  }
}

checkDocumentFields();





