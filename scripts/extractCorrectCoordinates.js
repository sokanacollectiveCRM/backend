require('dotenv').config();
const axios = require('axios');

async function extractCorrectCoordinates() {
  try {
    console.log('🔍 Extracting correct coordinates from json_attributes...');

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

    // Get document details
    const documentResponse = await axios.get(
      `https://api.signnow.com/document/${templateId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('📄 Document details:');
    console.log('Document ID:', documentResponse.data.id);
    console.log('Document name:', documentResponse.data.document_name);
    console.log('Total pages:', documentResponse.data.page_count);

    if (
      documentResponse.data.fields &&
      documentResponse.data.fields.length > 0
    ) {
      console.log('✅ Fields found in document:');
      documentResponse.data.fields.forEach((field, index) => {
        const attrs = field.json_attributes;
        console.log(`Field ${index + 1}:`, {
          name: attrs.name,
          type: field.type,
          page: attrs.page_number,
          position: `(${attrs.x}, ${attrs.y})`,
          size: `${attrs.width}x${attrs.height}`,
          role: field.role,
          required: attrs.required,
        });
      });

      // Extract coordinates from json_attributes
      console.log('\n📋 Extracted field coordinates for contract generation:');
      console.log('========================================================');

      const coordinates = {};
      documentResponse.data.fields.forEach((field) => {
        const attrs = field.json_attributes;

        if (field.type === 'signature') {
          coordinates.signature = {
            x: attrs.x,
            y: attrs.y,
            width: attrs.width,
            height: attrs.height,
            page: attrs.page_number,
          };
        } else if (
          field.type === 'text' &&
          attrs.name &&
          attrs.name.toLowerCase().includes('date')
        ) {
          coordinates.date = {
            x: attrs.x,
            y: attrs.y,
            width: attrs.width,
            height: attrs.height,
            page: attrs.page_number,
          };
        } else if (
          field.type === 'text' &&
          attrs.name &&
          attrs.name.toLowerCase().includes('initial')
        ) {
          coordinates.initials = {
            x: attrs.x,
            y: attrs.y,
            width: attrs.width,
            height: attrs.height,
            page: attrs.page_number,
          };
        } else if (
          field.type === 'text' &&
          attrs.name &&
          attrs.name.toLowerCase().includes('name')
        ) {
          coordinates.name = {
            x: attrs.x,
            y: attrs.y,
            width: attrs.width,
            height: attrs.height,
            page: attrs.page_number,
          };
        }
      });

      console.log('const fieldCoordinates = {');
      if (coordinates.signature) {
        console.log(
          `  signature: { x: ${coordinates.signature.x}, y: ${coordinates.signature.y}, width: ${coordinates.signature.width}, height: ${coordinates.signature.height}, page: ${coordinates.signature.page} },`
        );
      }
      if (coordinates.date) {
        console.log(
          `  date: { x: ${coordinates.date.x}, y: ${coordinates.date.y}, width: ${coordinates.date.width}, height: ${coordinates.date.height}, page: ${coordinates.date.page} },`
        );
      }
      if (coordinates.initials) {
        console.log(
          `  initials: { x: ${coordinates.initials.x}, y: ${coordinates.initials.y}, width: ${coordinates.initials.width}, height: ${coordinates.initials.height}, page: ${coordinates.initials.page} },`
        );
      }
      if (coordinates.name) {
        console.log(
          `  name: { x: ${coordinates.name.x}, y: ${coordinates.name.y}, width: ${coordinates.name.width}, height: ${coordinates.name.height}, page: ${coordinates.name.page} },`
        );
      }
      console.log('};');

      return coordinates;
    } else {
      console.log('❌ No fields found in document');
      return null;
    }
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    return null;
  }
}

// Run the script
extractCorrectCoordinates().then((coordinates) => {
  if (coordinates) {
    console.log('\n🎉 Field coordinates extracted successfully!');
    console.log(
      'You can now use these coordinates in your contract generation process.'
    );
  } else {
    console.log('\n❌ Failed to extract field coordinates');
  }
});





