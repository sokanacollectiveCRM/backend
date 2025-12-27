require('dotenv').config();
const axios = require('axios');

async function revertTemplateCoordinates() {
  try {
    console.log(
      '🔍 Reverting Labor Support template to original coordinates...'
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

    // Our Labor Support template ID
    const templateId = '6af732001d7944ee83cb6dde81846c3e83c241d8';

    // Revert to original target coordinates
    console.log('🔧 Reverting template to original coordinates...');

    const fieldData = {
      client_timestamp: Math.floor(Date.now() / 1000),
      fields: [
        {
          page_number: 2, // Last page (0-based indexing)
          type: 'signature',
          name: 'Client Signature',
          role: 'Signer 1',
          required: true,
          height: 35,
          width: 150,
          x: 380, // Original target x coordinate
          y: 220, // Original target y coordinate
        },
        {
          page_number: 2, // Last page (0-based indexing)
          type: 'text',
          name: 'Date',
          role: 'Signer 1',
          required: true,
          height: 25,
          width: 150,
          x: 100, // Original target x coordinate
          y: 275, // Original target y coordinate
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

    console.log('✅ Template reverted to original coordinates');

    // Wait for fields to be processed
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Verify the template was reverted
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
      console.log('✅ Verification - Template reverted successfully:');
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

      // Extract the reverted coordinates
      console.log('\n📋 Reverted Template Coordinates:');
      console.log('=================================');

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

      console.log('const revertedFieldCoordinates = {');
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

      console.log(
        '\n🎉 Labor Support template reverted to original coordinates!'
      );
      console.log('The template now uses the original target field positions.');
      console.log(
        `\n📄 Template URL: https://app.signnow.com/webapp/document/${templateId}`
      );

      return coordinates;
    } else {
      console.log('❌ No fields found after reverting template');
      return null;
    }
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    return null;
  }
}

// Run the script
revertTemplateCoordinates().then((coordinates) => {
  if (coordinates) {
    console.log('\n🎉 Template coordinates reverted successfully!');
    console.log(
      'The Labor Support template now uses the original target field positions.'
    );
    console.log(
      '\n💡 Future contract generations will use the original coordinates.'
    );
  } else {
    console.log('\n❌ Failed to revert template coordinates');
  }
});






