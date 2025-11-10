// Upload Labor Support Contract to SignNow
// This uploads the generated Labor Support PDF to SignNow and prepares it for signing
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

// SignNow API configuration
const SIGNNOW_BASE_URL =
  process.env.SIGNNOW_BASE_URL || 'https://api-eval.signnow.com';
const SIGNNOW_CLIENT_ID = process.env.SIGNNOW_CLIENT_ID;
const SIGNNOW_CLIENT_SECRET = process.env.SIGNNOW_CLIENT_SECRET;
const SIGNNOW_USERNAME = process.env.SIGNNOW_USERNAME;
const SIGNNOW_PASSWORD = process.env.SIGNNOW_PASSWORD;

async function authenticateWithSignNow() {
  try {
    console.log('🔐 Authenticating with SignNow...');

    // Use the same authentication method as the working service
    const params = new URLSearchParams({
      grant_type: 'password',
      client_id: SIGNNOW_CLIENT_ID,
      client_secret: SIGNNOW_CLIENT_SECRET,
      username: SIGNNOW_USERNAME,
      password: SIGNNOW_PASSWORD,
    });

    console.log('📝 Request params:', params.toString());

    const response = await fetch(`${SIGNNOW_BASE_URL}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Authentication error:', errorText);
      throw new Error(
        `SignNow authentication failed: ${response.status} ${response.statusText}`
      );
    }

    const tokenData = await response.json();
    console.log('✅ SignNow authentication successful');
    return tokenData.access_token;
  } catch (error) {
    console.error('❌ SignNow authentication failed:', error);
    throw error;
  }
}

async function uploadPdfToSignNow(pdfPath, token) {
  try {
    console.log('📤 Uploading Labor Support PDF to SignNow...');

    const formData = new FormData();
    const fileBuffer = await fs.promises.readFile(pdfPath);
    const blob = new Blob([fileBuffer], { type: 'application/pdf' });

    formData.append('file', blob, 'labor-support-contract.pdf');

    const response = await fetch(`${SIGNNOW_BASE_URL}/document`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `SignNow upload failed: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const result = await response.json();
    console.log('✅ Labor Support PDF uploaded to SignNow successfully');
    console.log('📄 Document ID:', result.id);
    return result.id;
  } catch (error) {
    console.error('❌ Error uploading to SignNow:', error);
    throw error;
  }
}

async function addSignatureFieldsToSignNow(documentId, token) {
  try {
    console.log('✍️ Adding signature fields to Labor Support document...');

    // SignNow field data for signature fields
    const fieldsData = {
      fields: [
        {
          type: 'signature',
          page_number: 1,
          x: 450,
          y: 380,
          width: 200,
          height: 50,
          required: true,
          label: 'Client Signature',
        },
        {
          type: 'text',
          page_number: 1,
          x: 150,
          y: 350,
          width: 120,
          height: 30,
          required: true,
          label: 'Date',
          placeholder: 'Date',
        },
        {
          type: 'text',
          page_number: 1,
          x: 450,
          y: 350,
          width: 80,
          height: 30,
          required: true,
          label: 'Initials',
          placeholder: 'Initials',
        },
      ],
    };

    const response = await fetch(
      `${SIGNNOW_BASE_URL}/api/document/${documentId}/fieldinvite`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(fieldsData),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `SignNow field addition failed: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const result = await response.json();
    console.log('✅ Signature fields added to Labor Support document');
    return result;
  } catch (error) {
    console.error('❌ Error adding signature fields:', error);
    throw error;
  }
}

async function createSigningInvitation(documentId, token) {
  try {
    console.log('📧 Creating signing invitation for Labor Support contract...');

    const invitationData = {
      to: 'jerrybony5@gmail.com',
      subject: 'Please sign your Labor Support Contract',
      message:
        'Please review and sign your Labor Support Contract. This contract outlines the terms for your doula services.',
      cc: [],
      bcc: [],
    };

    const response = await fetch(
      `${SIGNNOW_BASE_URL}/document/${documentId}/invite`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(invitationData),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `SignNow invitation failed: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const result = await response.json();
    console.log('✅ Signing invitation created successfully');
    return result;
  } catch (error) {
    console.error('❌ Error creating signing invitation:', error);
    throw error;
  }
}

async function uploadLaborSupportToSignNow() {
  try {
    console.log('🚀 UPLOADING LABOR SUPPORT CONTRACT TO SIGNNOW\n');

    // 1️⃣ Find the latest Labor Support PDF
    const generatedDir = path.join(process.cwd(), 'generated');
    const files = await fs.promises.readdir(generatedDir);

    const laborSupportPdf = files
      .filter(
        (file) =>
          file.startsWith('labor-support-final-') && file.endsWith('.pdf')
      )
      .sort()
      .pop();

    if (!laborSupportPdf) {
      throw new Error(
        'Labor Support PDF not found. Please run the contract generation script first.'
      );
    }

    const pdfPath = path.join(generatedDir, laborSupportPdf);
    console.log(`📄 Using Labor Support PDF: ${pdfPath}`);

    // 2️⃣ Authenticate with SignNow
    const token = await authenticateWithSignNow();

    // 3️⃣ Upload PDF to SignNow
    const documentId = await uploadPdfToSignNow(pdfPath, token);

    // 4️⃣ Add signature fields
    await addSignatureFieldsToSignNow(documentId, token);

    // 5️⃣ Create signing invitation
    await createSigningInvitation(documentId, token);

    console.log('\n🎉 LABOR SUPPORT CONTRACT UPLOADED SUCCESSFULLY!');
    console.log('\n📋 Summary:');
    console.log(`   📄 Document ID: ${documentId}`);
    console.log(`   📧 Invitation sent to: jerrybony5@gmail.com`);
    console.log(`   ✍️ Signature fields added`);
    console.log(`   📤 Contract ready for signing`);

    console.log('\n💡 Next Steps:');
    console.log('1. ✅ Labor Support contract uploaded to SignNow');
    console.log('2. 📧 Check email for signing invitation');
    console.log('3. ✍️ Sign the contract in SignNow');
    console.log('4. 📄 Download the signed contract');

    return {
      documentId,
      pdfPath,
      success: true,
    };
  } catch (error) {
    console.error(
      '❌ Error uploading Labor Support contract to SignNow:',
      error
    );
    throw error;
  }
}

// Run the upload
uploadLaborSupportToSignNow().catch(console.error);
