require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function uploadTemplateViaAPI(filePath) {
  try {
    console.log('🔍 Uploading template via SignNow API...');

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

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Read the file
    const fileBuffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);

    console.log(`📤 Uploading file: ${fileName} (${fileBuffer.length} bytes)`);

    // Create form data
    const FormData = require('form-data');
    const formData = new FormData();
    formData.append('file', fileBuffer, fileName);

    // Upload the file
    const response = await axios.post(
      'https://api.signnow.com/document',
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          ...formData.getHeaders(),
        },
      }
    );

    const documentId = response.data.id;
    console.log('✅ File uploaded successfully!');
    console.log(`📄 Document ID: ${documentId}`);

    // Check the uploaded document fields
    console.log('🔍 Checking uploaded document fields...');
    const docResponse = await axios.get(
      `https://api.signnow.com/document/${documentId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('📋 Document fields found:');
    console.log('================================');

    if (docResponse.data.fields && docResponse.data.fields.length > 0) {
      docResponse.data.fields.forEach((field, index) => {
        console.log(`Field ${index + 1}:`);
        console.log(`  Name: ${field.name}`);
        console.log(`  Type: ${field.type}`);
        console.log(`  Label: ${field.label || 'No label'}`);
        console.log(`  Role: ${field.role || 'No role'}`);
        console.log(`  Required: ${field.required}`);
        console.log(`  Page: ${field.page_number}`);
        console.log('---');
      });
    } else {
      console.log('❌ No fields found in uploaded document');
      console.log('🔍 This might mean Text Tags were not processed correctly');
    }

    return documentId;
  } catch (error) {
    console.error('❌ Error uploading template:', {
      error: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });
    throw error;
  }
}

// Run the script
const filePath = process.argv[2];
if (!filePath) {
  console.log('Usage: node scripts/uploadTemplateViaAPI.js <file-path>');
  console.log(
    'Example: node scripts/uploadTemplateViaAPI.js ./Labor Support Agreement for Service.docx'
  );
} else {
  uploadTemplateViaAPI(filePath);
}





