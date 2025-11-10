require('dotenv').config();
const axios = require('axios');

async function createNewLaborSupportDocument() {
  try {
    console.log('🔍 Creating new Labor Support document from SignNow template...');

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

    // Our Labor Support template with perfect coordinates
    const templateId = '6af732001d7944ee83cb6dde81846c3e83c241d8';

    // Get template info first
    console.log('📋 Getting template information...');
    const templateResponse = await axios.get(
      `https://api.signnow.com/document/${templateId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log(`📄 Template: ${templateResponse.data.document_name}`);
    console.log(`📄 Pages: ${templateResponse.data.page_count}`);
    console.log(`📄 Fields: ${templateResponse.data.fields?.length || 0}`);

    // Create a new document by uploading the template as a new document
    console.log('📄 Creating new document from template...');
    
    // Download the template document
    const downloadResponse = await axios.get(
      `https://api.signnow.com/document/${templateId}/download`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        responseType: 'arraybuffer'
      }
    );

    console.log(`📄 Downloaded template (${downloadResponse.data.length} bytes)`);

    // Upload as a new document
    const FormData = require('form-data');
    const form = new FormData();
    form.append('file', downloadResponse.data, {
      filename: 'Labor Support Agreement - New Contract.docx',
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });

    const uploadResponse = await axios.post(
      'https://api.signnow.com/document',
      form,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          ...form.getHeaders()
        }
      }
    );

    const newDocumentId = uploadResponse.data.id;
    console.log(`✅ New document created: ${newDocumentId}`);

    // Wait for document to be processed
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Add fields with perfect coordinates
    console.log('🔧 Adding fields with perfect coordinates...');
    
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

    console.log('✅ Fields added with perfect coordinates');

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

    console.log('\n📋 New Labor Support Contract Created:');
    console.log('=====================================');
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
    }

    return {
      documentId: newDocumentId,
      documentName: verifyResponse.data.document_name,
      pageCount: verifyResponse.data.page_count,
      fields: verifyResponse.data.fields,
      url: `https://app.signnow.com/webapp/document/${newDocumentId}`
    };

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    return null;
  }
}

// Run the script
createNewLaborSupportDocument().then((result) => {
  if (result) {
    console.log('\n🎉 New Labor Support contract created successfully!');
    console.log('The document has perfectly positioned signature and date fields.');
    console.log(`\n📄 Contract Details:`);
    console.log(`- ID: ${result.documentId}`);
    console.log(`- Name: ${result.documentName}`);
    console.log(`- URL: ${result.url}`);
    console.log('\n💡 This contract is ready for client signature!');
  } else {
    console.log('\n❌ Failed to create Labor Support contract');
  }
});





