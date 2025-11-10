require('dotenv').config();
const axios = require('axios');

async function createContractWithRevertedCoordinates() {
  try {
    console.log(
      '🔍 Creating new Labor Support contract with reverted coordinates...'
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

    // Use our reverted Labor Support template
    const templateId = '6af732001d7944ee83cb6dde81846c3e83c241d8';

    // Download the reverted template document
    console.log('📄 Downloading reverted template document...');
    const downloadResponse = await axios.get(
      `https://api.signnow.com/document/${templateId}/download`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        responseType: 'arraybuffer',
      }
    );

    console.log(
      `📄 Downloaded template (${downloadResponse.data.length} bytes)`
    );

    // Upload as a new document
    const FormData = require('form-data');
    const form = new FormData();
    form.append('file', downloadResponse.data, {
      filename: 'Labor Support Agreement - Reverted Coordinates.docx',
      contentType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    console.log('📤 Uploading new document to SignNow...');
    const uploadResponse = await axios.post(
      'https://api.signnow.com/document',
      form,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          ...form.getHeaders(),
        },
      }
    );

    const newDocumentId = uploadResponse.data.id;
    console.log(`✅ New document created: ${newDocumentId}`);

    // Wait for document to be processed
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Add fields with reverted coordinates
    console.log('🔧 Adding fields with reverted coordinates...');

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
          x: 380, // Reverted original x coordinate
          y: 220, // Reverted original y coordinate
        },
        {
          page_number: 2, // Last page (0-based indexing)
          type: 'text',
          name: 'Date',
          role: 'Signer 1',
          required: true,
          height: 25,
          width: 150,
          x: 100, // Reverted original x coordinate
          y: 275, // Reverted original y coordinate
          label: 'Date',
        },
      ],
    };

    const fieldResponse = await axios.put(
      `https://api.signnow.com/document/${newDocumentId}`,
      fieldData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Fields added with reverted coordinates');

    // Wait for fields to be processed
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Verify the document
    const verifyResponse = await axios.get(
      `https://api.signnow.com/document/${newDocumentId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('\n📋 New Labor Support Contract with Reverted Coordinates:');
    console.log('=======================================================');
    console.log(`Document ID: ${newDocumentId}`);
    console.log(`Document Name: ${verifyResponse.data.document_name}`);
    console.log(`Pages: ${verifyResponse.data.page_count}`);
    console.log(`Fields: ${verifyResponse.data.fields?.length || 0}`);

    console.log('\n🔗 Document URL:');
    console.log(`https://app.signnow.com/webapp/document/${newDocumentId}`);

    if (verifyResponse.data.fields && verifyResponse.data.fields.length > 0) {
      console.log('\n✅ Fields verification:');
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

      // Extract coordinates for verification
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

      console.log('\n📋 Final Coordinates:');
      console.log('====================');
      console.log(JSON.stringify(coordinates, null, 2));

      // Compare with our target
      console.log('\n📊 Coordinate Accuracy:');
      console.log('========================');
      console.log('Target Coordinates:');
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
    }

    return {
      documentId: newDocumentId,
      documentName: verifyResponse.data.document_name,
      pageCount: verifyResponse.data.page_count,
      fields: verifyResponse.data.fields,
      url: `https://app.signnow.com/webapp/document/${newDocumentId}`,
    };
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    return null;
  }
}

// Run the script
createContractWithRevertedCoordinates().then((result) => {
  if (result) {
    console.log(
      '\n🎉 New Labor Support contract created with reverted coordinates!'
    );
    console.log('The document uses the original target field positioning.');
    console.log(`\n📄 Contract Details:`);
    console.log(`- ID: ${result.documentId}`);
    console.log(`- Name: ${result.documentName}`);
    console.log(`- URL: ${result.url}`);
    console.log(
      '\n💡 This contract demonstrates the reverted coordinate system!'
    );
  } else {
    console.log('\n❌ Failed to create contract with reverted coordinates');
  }
});





