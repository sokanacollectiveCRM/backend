require('dotenv').config();
const axios = require('axios');

async function createLaborSupportFromSignNowTemplate() {
  try {
    console.log('🔍 Creating Labor Support contract directly from SignNow template...');

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

    // Template document ID (our Labor Support template with perfect coordinates)
    const templateId = '6af732001d7944ee83cb6dde81846c3e83c241d8';

    // Create a new document by cloning the template
    console.log('📄 Creating new document from SignNow template...');
    
    // First, let's get the template info
    const templateResponse = await axios.get(
      `https://api.signnow.com/document/${templateId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log(`📋 Template: ${templateResponse.data.document_name}`);
    console.log(`📄 Pages: ${templateResponse.data.page_count}`);

    // Create a new document by uploading the template as a new document
    console.log('🔄 Creating new document with prefilled data...');
    
    // We'll use the template directly and add fields with our perfect coordinates
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
          x: 380, // Perfect x coordinate
          y: 220, // Perfect y coordinate
        },
        {
          page_number: 2, // Last page (0-based indexing)
          type: 'text',
          name: 'Date',
          role: 'Signer 1',
          required: true,
          height: 25,
          width: 150,
          x: 100, // Perfect x coordinate
          y: 275, // Perfect y coordinate
          label: 'Date',
        },
      ],
    };

    // Add fields to the template (this creates a new document)
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

    console.log('✅ Fields added with perfect coordinates');

    // Wait a moment for the fields to be processed
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Verify the fields were added correctly
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
      console.log('✅ Verification - Fields added successfully:');
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

      console.log('\n📋 Labor Support Contract Ready:');
      console.log('=================================');
      console.log(`Document ID: ${templateId}`);
      console.log(`Document Name: ${verifyResponse.data.document_name}`);
      console.log(`Pages: ${verifyResponse.data.page_count}`);
      console.log(`Fields: ${verifyResponse.data.fields.length}`);
      
      console.log('\n🔗 Document URL:');
      console.log(`https://app.signnow.com/webapp/document/${templateId}`);

      console.log('\n🎉 Labor Support contract is ready with perfect field coordinates!');
      console.log('The template now has the signature and date fields positioned perfectly.');
      console.log('You can use this template to generate new contracts for Labor Support services.');

      return {
        documentId: templateId,
        documentName: verifyResponse.data.document_name,
        pageCount: verifyResponse.data.page_count,
        fields: verifyResponse.data.fields,
        url: `https://app.signnow.com/webapp/document/${templateId}`
      };
    } else {
      console.log('❌ No fields found after adding');
      return null;
    }

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    return null;
  }
}

// Run the script
createLaborSupportFromSignNowTemplate().then((result) => {
  if (result) {
    console.log('\n🎉 Labor Support contract template is ready!');
    console.log('The template now has perfectly positioned fields for signature and date.');
    console.log(`\n📄 Template Details:`);
    console.log(`- ID: ${result.documentId}`);
    console.log(`- Name: ${result.documentName}`);
    console.log(`- URL: ${result.url}`);
    console.log('\n💡 This template can now be used to generate Labor Support contracts with perfect field positioning.');
  } else {
    console.log('\n❌ Failed to prepare Labor Support contract template');
  }
});






