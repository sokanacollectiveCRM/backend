require('dotenv').config();
const axios = require('axios');

async function testDepositAmountPrefill() {
  try {
    console.log('🔍 Testing SignNow prefill with just depositAmount...');

    // First authenticate
    const authResponse = await axios.post(
      'https://api.signnow.com/oauth2/token',
      new URLSearchParams({
        grant_type: 'password',
        client_id: process.env.SIGNNOW_CLIENT_ID,
        client_secret: process.env.SIGNNOW_CLIENT_SECRET,
        username: process.env.SIGNNOW_USERNAME,
        password: process.env.SIGNNOW_PASSWORD,
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const token = authResponse.data.access_token;
    console.log('✅ Authentication successful');

    // Let's create a fresh document from the PDF we tested earlier
    console.log('📄 Creating fresh document from PDF...');
    const fs = require('fs');
    const path = require('path');
    const FormData = require('form-data');

    // Use the PDF file we tested earlier
    const pdfPath = path.join(
      __dirname,
      '..',
      'Labor Support Agreement for Service.docx.pdf'
    );
    const pdfBuffer = fs.readFileSync(pdfPath);

    const formData = new FormData();
    formData.append(
      'file',
      pdfBuffer,
      'Labor Support Agreement for Service.pdf'
    );

    const uploadResponse = await axios.post(
      'https://api.signnow.com/document',
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          ...formData.getHeaders(),
        },
      }
    );

    const documentId = uploadResponse.data.id;
    console.log('✅ Fresh document created:', documentId);

    // First, let's check what fields are available in this document
    console.log('🔍 Getting document fields...');
    const documentResponse = await axios.get(
      `https://api.signnow.com/document/${documentId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const fields = documentResponse.data.fields || [];
    console.log('📋 Available fields in document:');
    fields.forEach((field, index) => {
      console.log(`Field ${index + 1}:`);
      console.log(`  Name: ${field.json_attributes?.name || field.name}`);
      console.log(`  Type: ${field.type}`);
      console.log(
        `  Position: (${field.json_attributes?.x}, ${field.json_attributes?.y})`
      );
      console.log('---');
    });

    // First, let's add a depositAmount field to the document
    console.log('🔧 Adding depositAmount field to document...');
    const fieldData = {
      client_timestamp: Math.floor(Date.now() / 1000),
      fields: [
        {
          page_number: 1,
          type: 'text',
          name: 'depositAmount',
          role: 'Signer 1',
          required: true,
          height: 25,
          width: 100,
          x: 300, // Position near the deposit amount text
          y: 400,
          label: 'Deposit Amount',
          prefilled_text: '$600.00', // Prefill it directly when adding
        },
      ],
    };

    await axios.put(
      `https://api.signnow.com/document/${documentId}`,
      fieldData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Deposit amount field added and prefilled successfully');
    console.log('✅ Template cloned successfully:', documentId);
    console.log(
      '🌐 Document URL: https://app.signnow.com/webapp/document/' + documentId
    );

    // Verify the field was prefilled
    console.log('🔍 Verifying depositAmount was prefilled...');
    const verifyResponse = await axios.get(
      `https://api.signnow.com/document/${documentId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const verifyFields = verifyResponse.data.fields || [];
    console.log('📋 Document fields after prefilling:');
    verifyFields.forEach((field, index) => {
      if (field.json_attributes?.name === 'depositAmount') {
        console.log(`✅ Found depositAmount field:`);
        console.log(`  Name: ${field.json_attributes.name}`);
        console.log(`  Type: ${field.type}`);
        console.log(
          `  Value: ${field.prefilled_text || field.data || 'No value'}`
        );
        console.log(
          `  Position: (${field.json_attributes.x}, ${field.json_attributes.y})`
        );
      }
    });

    // Send invitation
    console.log('📧 Sending signing invitation...');
    const invitePayload = {
      to: [
        {
          email: 'jerrybony5@gmail.com',
          role: 'Signer 1',
          order: 1,
        },
      ],
      from: 'jerry@techluminateacademy.com',
      redirect_uri: 'https://jerrybony.me/payment?contract_id=test-deposit',
      decline_redirect_uri: 'https://jerrybony.me/',
    };

    const inviteResponse = await axios.post(
      `https://api.signnow.com/document/${documentId}/invite`,
      invitePayload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Invitation sent successfully');
    console.log('🎉 Deposit amount prefill test completed!');
    console.log('📋 Document ID:', documentId);
    console.log(
      '🌐 SignNow URL: https://app.signnow.com/webapp/document/' + documentId
    );
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error(
        'Response data:',
        JSON.stringify(error.response.data, null, 2)
      );
    }
  }
}

testDepositAmountPrefill();
