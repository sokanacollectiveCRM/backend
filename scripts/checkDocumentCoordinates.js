require('dotenv').config();
const axios = require('axios');

async function checkDocumentCoordinates() {
  try {
    console.log('🔍 Checking coordinates of SignNow document...');

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

    // Document ID from the URL
    const documentId = '9cd9a8aff85f41c7b5f98dad97dd04d6cc3d55f0';

    // Get document info
    const response = await axios.get(
      `https://api.signnow.com/document/${documentId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('📄 Document Information:');
    console.log(`Document Name: ${response.data.document_name}`);
    console.log(`Pages: ${response.data.page_count}`);
    console.log(`Fields: ${response.data.fields?.length || 0}`);

    if (response.data.fields && response.data.fields.length > 0) {
      console.log('\n📋 Current Field Coordinates:');
      console.log('============================');

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
      });

      // Extract coordinates for comparison
      const coordinates = {};
      response.data.fields.forEach((field) => {
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
        } else if (field.type === 'initials') {
          if (!coordinates.initials) coordinates.initials = [];
          coordinates.initials.push({
            name: attrs.name,
            x: attrs.x,
            y: attrs.y,
            width: attrs.width,
            height: attrs.height,
            page: attrs.page_number,
          });
        }
      });

      console.log('\n📋 Extracted Coordinates:');
      console.log('=========================');
      console.log(JSON.stringify(coordinates, null, 2));

      console.log('\n💻 Code snippet for future use:');
      console.log('===============================');
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
      if (coordinates.initials && coordinates.initials.length > 0) {
        console.log('  initials: [');
        coordinates.initials.forEach((initial, index) => {
          console.log(
            `    { name: "${initial.name}", x: ${initial.x}, y: ${initial.y}, width: ${initial.width}, height: ${initial.height}, page: ${initial.page} }${index < coordinates.initials.length - 1 ? ',' : ''}`
          );
        });
        console.log('  ],');
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
checkDocumentCoordinates().then((coordinates) => {
  if (coordinates) {
    console.log('\n🎉 Document coordinates extracted successfully!');
    console.log(
      'These are the current field positions in the SignNow document.'
    );
  } else {
    console.log('\n❌ Failed to extract document coordinates');
  }
});





