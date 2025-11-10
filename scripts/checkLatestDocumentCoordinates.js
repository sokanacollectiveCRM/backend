require('dotenv').config();
const axios = require('axios');

async function checkLatestDocumentCoordinates() {
  try {
    console.log('🔍 Checking coordinates of latest SignNow document...');

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
    const documentId = 'c0e14ed197d84510a57cf5c4131cabc3e57b5e64';

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

      // Compare with our target coordinates
      console.log('\n📊 Coordinate Comparison:');
      console.log('==========================');
      console.log('Our Target Coordinates:');
      console.log(
        '  signature: { x: 380, y: 220, width: 150, height: 35, page: 2 }'
      );
      console.log(
        '  date: { x: 100, y: 275, width: 150, height: 25, page: 2 }'
      );

      if (coordinates.signature) {
        const sigDiff = {
          x: coordinates.signature.x - 380,
          y: coordinates.signature.y - 220,
        };
        console.log(`\nSignature Field Difference:`);
        console.log(
          `  x: ${coordinates.signature.x} (target: 380) = ${sigDiff.x > 0 ? '+' : ''}${sigDiff.x}`
        );
        console.log(
          `  y: ${coordinates.signature.y} (target: 220) = ${sigDiff.y > 0 ? '+' : ''}${sigDiff.y}`
        );
      }

      if (coordinates.date) {
        const dateDiff = {
          x: coordinates.date.x - 100,
          y: coordinates.date.y - 275,
        };
        console.log(`\nDate Field Difference:`);
        console.log(
          `  x: ${coordinates.date.x} (target: 100) = ${dateDiff.x > 0 ? '+' : ''}${dateDiff.x}`
        );
        console.log(
          `  y: ${coordinates.date.y} (target: 275) = ${dateDiff.y > 0 ? '+' : ''}${dateDiff.y}`
        );
      }

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
checkLatestDocumentCoordinates().then((coordinates) => {
  if (coordinates) {
    console.log('\n🎉 Latest document coordinates extracted successfully!');
    console.log(
      'These are the current field positions in the latest SignNow document.'
    );
  } else {
    console.log('\n❌ Failed to extract latest document coordinates');
  }
});





