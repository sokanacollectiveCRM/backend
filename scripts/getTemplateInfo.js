require('dotenv').config();
const axios = require('axios');

async function getTemplateInfo() {
  try {
    console.log('🔍 Getting template information...');

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

    // Get template details
    const templateResponse = await axios.get(
      `https://api.signnow.com/document/${templateId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('📄 Template details:');
    console.log('Document ID:', templateResponse.data.id);
    console.log('Document name:', templateResponse.data.document_name);
    console.log('Total pages:', templateResponse.data.page_count);
    console.log(
      'Pages array length:',
      templateResponse.data.pages
        ? templateResponse.data.pages.length
        : 'No pages array'
    );

    if (templateResponse.data.pages) {
      console.log('📋 Pages info:');
      templateResponse.data.pages.forEach((page, index) => {
        console.log(`  Page ${index + 1}:`, {
          id: page.id,
          page_number: page.page_number,
          width: page.width,
          height: page.height,
        });
      });
    }

    if (
      templateResponse.data.fields &&
      templateResponse.data.fields.length > 0
    ) {
      console.log('✅ Current fields in template:');
      templateResponse.data.fields.forEach((field, index) => {
        console.log(`Field ${index + 1}:`, {
          name: field.name,
          type: field.type,
          page: field.page_number,
          position: `(${field.x}, ${field.y})`,
          size: `${field.width}x${field.height}`,
          role: field.role,
        });
      });
    } else {
      console.log('❌ No fields found in template');
    }

    // Now let's add fields to the correct page (last page)
    const lastPageNumber = templateResponse.data.page_count;
    console.log(`\n🔧 Adding fields to page ${lastPageNumber}...`);

    const fieldData = {
      client_timestamp: Math.floor(Date.now() / 1000),
      fields: [
        {
          page_number: lastPageNumber,
          type: 'signature',
          name: 'Client Signature',
          role: 'Signer 1',
          required: true,
          height: 50,
          width: 200,
          x: 300,
          y: 650,
        },
        {
          page_number: lastPageNumber,
          type: 'text',
          name: 'Date',
          role: 'Signer 1',
          required: true,
          height: 25,
          width: 150,
          x: 500,
          y: 650,
          label: 'Date',
        },
        {
          page_number: lastPageNumber,
          type: 'text',
          name: 'Initials',
          role: 'Signer 1',
          required: true,
          height: 25,
          width: 100,
          x: 300,
          y: 600,
          label: 'Initials',
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

    console.log('✅ Fields added successfully');

    // Verify the fields were added with coordinates
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
      console.log('✅ Verification - Fields with coordinates:');
      verifyResponse.data.fields.forEach((field, index) => {
        console.log(`Field ${index + 1}:`, {
          name: field.name,
          type: field.type,
          page: field.page_number,
          position: `(${field.x}, ${field.y})`,
          size: `${field.width}x${field.height}`,
          role: field.role,
        });
      });

      // Extract coordinates for contract generation
      console.log('\n📋 Extracted field coordinates for contract generation:');
      console.log('========================================================');

      const coordinates = {};
      verifyResponse.data.fields.forEach((field) => {
        if (field.type === 'signature') {
          coordinates.signature = {
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
          coordinates.date = {
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
          coordinates.initials = {
            x: field.x,
            y: field.y,
            width: field.width,
            height: field.height,
            page: field.page_number,
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
      console.log('};');

      return coordinates;
    }
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    return null;
  }
}

// Run the script
getTemplateInfo().then((coordinates) => {
  if (coordinates) {
    console.log('\n🎉 Template information retrieved successfully!');
    console.log(
      'You can now use these coordinates in your contract generation process.'
    );
  } else {
    console.log('\n❌ Failed to get template information');
  }
});





