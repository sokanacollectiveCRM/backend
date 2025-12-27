require('dotenv').config();
const axios = require('axios');

async function moveFieldsUpMore() {
  try {
    console.log('🔍 Moving fields up a little more...');

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

    // Move both fields up a little more
    console.log('🔧 Moving fields up a little more...');

    const fieldData = {
      client_timestamp: Math.floor(Date.now() / 1000),
      fields: [
        {
          page_number: 2, // Last page
          type: 'text',
          name: 'Date',
          role: 'Signer 1',
          required: true,
          height: 25,
          width: 150,
          x: 100, // Keep on left side
          y: 275, // Move date up a little more (was 290)
          label: 'Date',
        },
        {
          page_number: 2, // Last page
          type: 'signature',
          name: 'Client Signature',
          role: 'Signer 1',
          required: true,
          height: 50,
          width: 200,
          x: 350, // Keep on right side
          y: 265, // Move signature up a little more (was 280)
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

    console.log('✅ Fields moved up a little more');

    // Wait a moment for the fields to be processed
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Verify the fields were moved up more
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
      console.log('✅ Verification - Fields moved up more:');
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

      // Extract the updated coordinates
      console.log('\n📋 Updated field coordinates (moved up more):');
      console.log('============================================');

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
      console.log('❌ No fields found after moving up more');
      return null;
    }
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    return null;
  }
}

// Run the script
moveFieldsUpMore().then((coordinates) => {
  if (coordinates) {
    console.log('\n🎉 Fields moved up a little more successfully!');
    console.log(
      'Both date and signature fields are now positioned higher for better alignment.'
    );
  } else {
    console.log('\n❌ Failed to move fields up more');
  }
});






