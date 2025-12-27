require('dotenv').config();
const axios = require('axios');

async function extractFinalCoordinates() {
  try {
    console.log(
      '🔍 Extracting final field coordinates from Labor Support template...'
    );

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

    console.log('Document name:', response.data.document_name);
    console.log('Pages:', response.data.page_count);

    if (response.data.fields && response.data.fields.length > 0) {
      console.log('✅ Fields found in template:');

      const fieldCoordinates = {};

      response.data.fields.forEach((field, index) => {
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

        // Store coordinates for different field types
        if (field.type === 'signature' && attrs.name === 'Client Signature') {
          fieldCoordinates.signature = {
            x: attrs.x,
            y: attrs.y,
            width: attrs.width,
            height: attrs.height,
            page: attrs.page_number,
          };
        } else if (field.type === 'text' && attrs.name === 'Date') {
          fieldCoordinates.date = {
            x: attrs.x,
            y: attrs.y,
            width: attrs.width,
            height: attrs.height,
            page: attrs.page_number,
          };
        } else if (field.type === 'text' && attrs.name === 'Initials') {
          fieldCoordinates.initials = {
            x: attrs.x,
            y: attrs.y,
            width: attrs.width,
            height: attrs.height,
            page: attrs.page_number,
          };
        } else if (field.type === 'text' && attrs.name === 'Client Name') {
          fieldCoordinates.name = {
            x: attrs.x,
            y: attrs.y,
            width: attrs.width,
            height: attrs.height,
            page: attrs.page_number,
          };
        }
      });

      console.log('\n📋 Final field coordinates for Labor Support Agreement:');
      console.log('=======================================================');

      console.log(JSON.stringify(fieldCoordinates, null, 2));

      console.log('\n💻 Code snippet for contract generation:');
      console.log('==========================================');
      console.log('const laborSupportFieldCoordinates = {');
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
      if (fieldCoordinates.name) {
        console.log(
          `  name: { x: ${fieldCoordinates.name.x}, y: ${fieldCoordinates.name.y}, width: ${fieldCoordinates.name.width}, height: ${fieldCoordinates.name.height}, page: ${fieldCoordinates.name.page} },`
        );
      }
      console.log('};');

      // Save to file for future reference
      const fs = require('fs');
      const coordinatesData = {
        templateId: templateId,
        templateName: 'Labor Support Agreement for Service',
        documentName: response.data.document_name,
        pageCount: response.data.page_count,
        fieldCoordinates: fieldCoordinates,
        extractedAt: new Date().toISOString(),
        note: 'Perfect positioning achieved through iterative adjustment',
      };

      fs.writeFileSync(
        'labor-support-field-coordinates.json',
        JSON.stringify(coordinatesData, null, 2)
      );

      console.log(
        '\n💾 Saved coordinates to: labor-support-field-coordinates.json'
      );

      return fieldCoordinates;
    } else {
      console.log('❌ No fields found in template');
      return null;
    }
  } catch (error) {
    console.error(
      'Error extracting final coordinates:',
      error.response ? error.response.data : error.message
    );
    return null;
  }
}

// Run the script
extractFinalCoordinates().then((coordinates) => {
  if (coordinates) {
    console.log('\n🎉 Final coordinates extracted and saved successfully!');
    console.log(
      'These coordinates are now ready for Labor Support contract generation.'
    );
  } else {
    console.log('\n❌ Failed to extract final coordinates');
  }
});






