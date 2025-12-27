require('dotenv').config();
const axios = require('axios');

async function checkRevertedDocumentCoordinates() {
  try {
    console.log('🔍 Checking actual coordinates of the reverted document...');

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

    // Document ID from the reverted contract
    const documentId = '024442396c784e7c9ef72f0fedc96a80e7788aa4';

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
      console.log('\n📋 Actual Field Coordinates:');
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
        }
      });

      console.log('\n📋 Extracted Coordinates:');
      console.log('=========================');
      console.log(JSON.stringify(coordinates, null, 2));

      // Compare with our target
      console.log('\n📊 Coordinate Comparison:');
      console.log('==========================');
      console.log('Our Target Coordinates:');
      console.log('  signature: { x: 380, y: 220 }');
      console.log('  date: { x: 100, y: 275 }');

      if (coordinates.signature) {
        const sigDiff = {
          x: coordinates.signature.x - 380,
          y: coordinates.signature.y - 220,
        };
        console.log(`\nSignature Field:`);
        console.log(
          `  Current: (${coordinates.signature.x}, ${coordinates.signature.y})`
        );
        console.log(`  Target:  (380, 220)`);
        console.log(
          `  Difference: (${sigDiff.x > 0 ? '+' : ''}${sigDiff.x}, ${sigDiff.y > 0 ? '+' : ''}${sigDiff.y})`
        );
      }

      if (coordinates.date) {
        const dateDiff = {
          x: coordinates.date.x - 100,
          y: coordinates.date.y - 275,
        };
        console.log(`\nDate Field:`);
        console.log(
          `  Current: (${coordinates.date.x}, ${coordinates.date.y})`
        );
        console.log(`  Target:  (100, 275)`);
        console.log(
          `  Difference: (${dateDiff.x > 0 ? '+' : ''}${dateDiff.x}, ${dateDiff.y > 0 ? '+' : ''}${dateDiff.y})`
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
checkRevertedDocumentCoordinates().then((coordinates) => {
  if (coordinates) {
    console.log('\n🎉 Actual document coordinates extracted successfully!');
    console.log('These are the real field positions in the SignNow document.');
  } else {
    console.log('\n❌ Failed to extract actual document coordinates');
  }
});






