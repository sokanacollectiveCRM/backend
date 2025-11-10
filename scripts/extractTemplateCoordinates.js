require('dotenv').config();
const axios = require('axios');

async function extractTemplateCoordinates() {
  try {
    console.log('🔍 Extracting field coordinates from SignNow template...');

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

    // Template document ID from the URL
    const templateId = '6af732001d7944ee83cb6dde81846c3e83c241d8';

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

    console.log('📄 Template details:');
    console.log('Document ID:', response.data.id);
    console.log('Document name:', response.data.document_name);
    console.log('Pages:', response.data.page_count);

    if (response.data.fields && response.data.fields.length > 0) {
      console.log('✅ Fields found in template:');

      const fieldCoordinates = {};

      response.data.fields.forEach((field, index) => {
        console.log(`Field ${index + 1}:`, {
          name: field.name,
          type: field.type,
          page: field.page_number,
          position: `(${field.x}, ${field.y})`,
          size: `${field.width}x${field.height}`,
          role: field.role,
          required: field.required,
        });

        // Store coordinates for different field types
        if (field.type === 'signature') {
          fieldCoordinates.signature = {
            x: field.x,
            y: field.y,
            width: field.width,
            height: field.height,
            page: field.page_number,
          };
        } else if (
          field.type === 'text' &&
          field.name &&
          field.name.toLowerCase().includes('date')
        ) {
          fieldCoordinates.date = {
            x: field.x,
            y: field.y,
            width: field.width,
            height: field.height,
            page: field.page_number,
          };
        } else if (
          field.type === 'text' &&
          field.name &&
          field.name.toLowerCase().includes('initial')
        ) {
          fieldCoordinates.initials = {
            x: field.x,
            y: field.y,
            width: field.width,
            height: field.height,
            page: field.page_number,
          };
        }
      });

      console.log('\n📋 Extracted field coordinates:');
      console.log('================================');

      if (fieldCoordinates.signature) {
        console.log('Signature field:');
        console.log(`  x: ${fieldCoordinates.signature.x}`);
        console.log(`  y: ${fieldCoordinates.signature.y}`);
        console.log(`  width: ${fieldCoordinates.signature.width}`);
        console.log(`  height: ${fieldCoordinates.signature.height}`);
        console.log(`  page: ${fieldCoordinates.signature.page}`);
      }

      if (fieldCoordinates.date) {
        console.log('Date field:');
        console.log(`  x: ${fieldCoordinates.date.x}`);
        console.log(`  y: ${fieldCoordinates.date.y}`);
        console.log(`  width: ${fieldCoordinates.date.width}`);
        console.log(`  height: ${fieldCoordinates.date.height}`);
        console.log(`  page: ${fieldCoordinates.date.page}`);
      }

      if (fieldCoordinates.initials) {
        console.log('Initials field:');
        console.log(`  x: ${fieldCoordinates.initials.x}`);
        console.log(`  y: ${fieldCoordinates.initials.y}`);
        console.log(`  width: ${fieldCoordinates.initials.width}`);
        console.log(`  height: ${fieldCoordinates.initials.height}`);
        console.log(`  page: ${fieldCoordinates.initials.page}`);
      }

      // Generate code snippet for use in contract generation
      console.log('\n💻 Code snippet for contract generation:');
      console.log('==========================================');
      console.log('const fieldCoordinates = {');
      if (fieldCoordinates.signature) {
        console.log(
          `  signature: { x: ${fieldCoordinates.signature.x}, y: ${fieldCoordinates.signature.y}, width: ${fieldCoordinates.signature.width}, height: ${fieldCoordinates.signature.height}, page: ${fieldCoordinates.signature.page} },`
        );
      }
      if (fieldCoordinates.date) {
        console.log(
          `  date: { x: ${fieldCoordinates.date.x}, y: ${fieldCoordinates.date.y}, width: ${fieldCoordinates.date.width}, height: ${fieldCoordinates.date.height}, page: ${fieldCoordinates.date.page} },`
        );
      }
      if (fieldCoordinates.initials) {
        console.log(
          `  initials: { x: ${fieldCoordinates.initials.x}, y: ${fieldCoordinates.initials.y}, width: ${fieldCoordinates.initials.width}, height: ${fieldCoordinates.initials.height}, page: ${fieldCoordinates.initials.page} },`
        );
      }
      console.log('};');

      return fieldCoordinates;
    } else {
      console.log('❌ No fields found in template');
      return null;
    }
  } catch (error) {
    console.error(
      '❌ Error extracting coordinates:',
      error.response?.data || error.message
    );
    return null;
  }
}

// Run the script
extractTemplateCoordinates().then((coordinates) => {
  if (coordinates) {
    console.log('\n🎉 Field coordinates extracted successfully!');
    console.log(
      'You can now use these coordinates in your contract generation process.'
    );
  } else {
    console.log('\n❌ Failed to extract field coordinates');
  }
});





