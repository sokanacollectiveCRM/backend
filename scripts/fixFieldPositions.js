require('dotenv').config();
const axios = require('axios');

async function fixFieldPositions() {
  try {
    console.log('🔍 Fixing field positions to be visible on the page...');

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

    // Get document info to check page dimensions
    const documentResponse = await axios.get(
      `https://api.signnow.com/document/${templateId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('📄 Document info:');
    console.log('Pages:', documentResponse.data.pages);
    console.log('Page count:', documentResponse.data.page_count);

    // Check page dimensions (typically 612x792 for US Letter)
    if (documentResponse.data.pages && documentResponse.data.pages.length > 0) {
      const pageSize = documentResponse.data.pages[0].size;
      console.log('Page dimensions:', pageSize);
      console.log('Page width:', pageSize.width);
      console.log('Page height:', pageSize.height);
    }

    // Move fields to a better position (middle-bottom of page)
    // US Letter is typically 612x792, so y: 700 is very close to the bottom
    // Let's move them to y: 650 (about 1.5 inches from bottom)
    console.log('🔧 Repositioning fields to be more visible...');

    const fieldData = {
      client_timestamp: Math.floor(Date.now() / 1000),
      fields: [
        {
          page_number: 1,
          type: 'signature',
          name: 'Client Signature',
          role: 'Signer 1',
          required: true,
          height: 50,
          width: 200,
          x: 100, // Move to left side
          y: 650, // Move up from 700 to 650
        },
        {
          page_number: 1,
          type: 'text',
          name: 'Date',
          role: 'Signer 1',
          required: true,
          height: 25,
          width: 150,
          x: 350, // Move to right side
          y: 650, // Move up from 700 to 650
          label: 'Date',
        },
      ],
    };

    const fieldResponse = await axios.put(
      `https://api.signnow.com/document/${templateId}`,
      fieldData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Fields repositioned');

    // Wait a moment for the fields to be processed
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Verify the fields were repositioned
    const verifyResponse = await axios.get(
      `https://api.signnow.com/document/${templateId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (verifyResponse.data.fields && verifyResponse.data.fields.length > 0) {
      console.log('✅ Verification - Repositioned fields:');
      verifyResponse.data.fields.forEach((field, index) => {
        const attrs = field.json_attributes;
        console.log(`Field ${index + 1}:`, {
          name: attrs.name,
          type: field.type,
          page: attrs.page_number,
          position: `(${attrs.x}, ${attrs.y})`,
          size: `${attrs.width}x${attrs.height}`,
          role: field.role,
        });
      });

      // Extract the corrected coordinates
      console.log('\n📋 Corrected field coordinates for contract generation:');
      console.log('======================================================');

      const coordinates = {};
      verifyResponse.data.fields.forEach((field) => {
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
      console.log('};');

      return coordinates;
    } else {
      console.log('❌ No fields found after repositioning');
      return null;
    }
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    return null;
  }
}

// Run the script
fixFieldPositions().then((coordinates) => {
  if (coordinates) {
    console.log('\n🎉 Field positions fixed successfully!');
    console.log('The fields should now be visible on the page.');
  } else {
    console.log('\n❌ Failed to fix field positions');
  }
});






