require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function testPdfSignature() {
  try {
    console.log('🔍 Testing PDF signature placement...');

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

    // Find the PDF file in the project
    const pdfPath = path.join(
      __dirname,
      '..',
      'Labor Support Agreement for Service.docx.pdf'
    );

    if (!fs.existsSync(pdfPath)) {
      console.error('❌ PDF file not found:', pdfPath);
      return;
    }

    console.log('📄 Found PDF file:', pdfPath);

    // Read the PDF file
    const pdfBuffer = fs.readFileSync(pdfPath);
    console.log(`📄 PDF size: ${pdfBuffer.length} bytes`);

    // Upload PDF to SignNow
    const FormData = require('form-data');
    const formData = new FormData();
    formData.append(
      'file',
      pdfBuffer,
      'Labor Support Agreement for Service.pdf'
    );

    console.log('📤 Uploading PDF to SignNow...');
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
    console.log('✅ PDF uploaded successfully:', documentId);
    console.log(
      '🌐 Document URL: https://app.signnow.com/webapp/document/' + documentId
    );

    // Add signature fields with correct coordinates
    console.log('✍️ Adding signature fields...');

    const fieldData = {
      client_timestamp: Math.floor(Date.now() / 1000),
      fields: [
        // Signature field at correct position
        {
          page_number: 2,
          type: 'signature',
          name: 'client_signature',
          role: 'Signer 1',
          required: true,
          height: 25,
          width: 150,
          x: 384, // Corrected coordinates
          y: 218,
        },
        // Date field at correct position
        {
          page_number: 2,
          type: 'text',
          name: 'signature_date',
          role: 'Signer 1',
          required: true,
          height: 25,
          width: 120,
          x: 111, // Corrected coordinates
          y: 274,
          label: 'Date',
        },
        // Initials fields at correct positions
        {
          page_number: 1,
          type: 'initials',
          name: 'total_amount_initials',
          role: 'Signer 1',
          required: true,
          height: 21,
          width: 69,
          x: 228, // Corrected coordinates
          y: 579,
          label: 'Initials',
        },
        {
          page_number: 1,
          type: 'initials',
          name: 'deposit_amount_initials',
          role: 'Signer 1',
          required: true,
          height: 21,
          width: 69,
          x: 259, // Corrected coordinates
          y: 602,
          label: 'Initials',
        },
        {
          page_number: 1,
          type: 'initials',
          name: 'additional_initials',
          role: 'Signer 1',
          required: true,
          height: 21,
          width: 69,
          x: 235, // Corrected coordinates
          y: 623,
          label: 'Initials',
        },
      ],
    };

    console.log('📋 Field data:', JSON.stringify(fieldData, null, 2));

    const fieldsResponse = await axios.put(
      `https://api.signnow.com/document/${documentId}`,
      fieldData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Signature fields added successfully');

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
      redirect_uri: 'https://jerrybony.me/payment?contract_id=test-pdf',
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
    console.log('🎉 PDF signature test completed!');
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

testPdfSignature();
