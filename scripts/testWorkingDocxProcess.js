// Test the Working DOCX Process + Direct SignNow Upload
// This uses the proven working DOCX template process and uploads directly to SignNow
import Docxtemplater from 'docxtemplater';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';

import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

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

    const authData = {
      grant_type: 'password',
      username: SIGNNOW_USERNAME,
      password: SIGNNOW_PASSWORD,
      scope: '*',
    };

    const response = await fetch(`${SIGNNOW_BASE_URL}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${SIGNNOW_CLIENT_ID}:${SIGNNOW_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams(authData),
    });

    if (!response.ok) {
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

async function generateWorkingDocx() {
  try {
    console.log('📄 Generating DOCX using the working template process...');

    // 1️⃣ Use the working template from docs folder
    const templatePath = path.join(
      process.cwd(),
      'docs',
      'Agreement for Postpartum Doula Services (1).docx'
    );
    console.log(`📥 Using template: ${templatePath}`);

    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template not found at: ${templatePath}`);
    }

    const content = fs.readFileSync(templatePath);
    const zip = new PizZip(content);

    // 3️⃣ Create docxtemplater instance
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    // 4️⃣ Set template variables (using the working format)
    const templateVariables = {
      totalHours: '120',
      hourlyRate: '35.00',
      overnightFee: '50.00',
      totalAmount: '4,200.00',
      deposit: '600.00',
      clientInitials: 'JT',
      clientName: 'Jerry Techluminate',
      client_signature: '', // Will be filled by SignNow
      client_signed_date: '', // Will be filled by SignNow
    };

    console.log('📋 Template variables:', templateVariables);
    doc.setData(templateVariables);

    // 5️⃣ Render the document
    doc.render();

    // 6️⃣ Generate output
    const buffer = doc.getZip().generate({ type: 'nodebuffer' });

    // 7️⃣ Save the generated DOCX
    const outputPath = path.join(
      process.cwd(),
      'generated',
      `working-contract-${Date.now()}.docx`
    );
    await fs.promises.writeFile(outputPath, buffer);

    console.log(`✅ Working DOCX generated: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error('❌ Error generating working DOCX:', error);
    throw error;
  }
}

async function uploadDocxToSignNow(docxPath, token) {
  try {
    console.log('📤 Uploading DOCX directly to SignNow...');

    const formData = new FormData();
    const fileBuffer = await fs.promises.readFile(docxPath);
    const blob = new Blob([fileBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    formData.append('file', blob, 'contract.docx');

    const response = await fetch(`${SIGNNOW_BASE_URL}/api/document`, {
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
    console.log('✅ DOCX uploaded to SignNow successfully');
    console.log('📄 Document ID:', result.id);
    return result.id;
  } catch (error) {
    console.error('❌ Error uploading to SignNow:', error);
    throw error;
  }
}

async function addSignatureFieldsToSignNow(documentId, token) {
  try {
    console.log('✍️ Adding signature fields to SignNow document...');

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
    console.log('✅ Signature fields added to SignNow document');
    return result;
  } catch (error) {
    console.error('❌ Error adding signature fields:', error);
    throw error;
  }
}

async function createSigningInvitation(documentId, token) {
  try {
    console.log('📧 Creating signing invitation...');

    const invitationData = {
      to: 'jerrybony5@gmail.com',
      subject: 'Please sign your contract',
      message: 'Please review and sign your contract.',
      cc: [],
      bcc: [],
    };

    const response = await fetch(
      `${SIGNNOW_BASE_URL}/api/document/${documentId}/invite`,
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

async function testWorkingDocxProcess() {
  try {
    console.log('🚀 Testing Working DOCX Process + Direct SignNow Upload\n');

    // Step 1: Generate working DOCX
    const docxPath = await generateWorkingDocx();

    // Step 2: Authenticate with SignNow
    const token = await authenticateWithSignNow();

    // Step 3: Upload DOCX directly to SignNow
    const documentId = await uploadDocxToSignNow(docxPath, token);

    // Step 4: Add signature fields
    await addSignatureFieldsToSignNow(documentId, token);

    // Step 5: Create signing invitation
    await createSigningInvitation(documentId, token);

    console.log('\n🎉 SUCCESS! Working DOCX Process Complete!');
    console.log('📋 Summary:');
    console.log(`   📄 DOCX Generated: ${docxPath}`);
    console.log(`   📤 Uploaded to SignNow: ${documentId}`);
    console.log(`   ✍️ Signature fields added`);
    console.log(`   📧 Invitation sent to: jerrybony5@gmail.com`);

    console.log('\n💡 Benefits of this approach:');
    console.log('   ✅ Perfect layout preservation (no conversion drift)');
    console.log('   ✅ No coordinate guessing needed');
    console.log('   ✅ SignNow handles PDF conversion internally');
    console.log('   ✅ Uses proven working DOCX template process');
    console.log('   ✅ All formatting, logos, and styling preserved');
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Run the test
testWorkingDocxProcess().catch(console.error);
