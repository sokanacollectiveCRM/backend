require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const Docxtemplater = require('docxtemplater');
const PizZip = require('pizzip');

async function uploadReplaceAndAddFields() {
  try {
    console.log(
      '🔍 Uploading document, replacing placeholders, and adding fields...'
    );

    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials in environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Download the Labor Support template from Supabase
    console.log('📥 Downloading Labor Support template from Supabase...');
    const templateFileName = 'Labor Support Agreement for Service.docx';

    const { data: templateBlob, error: downloadError } = await supabase.storage
      .from('contract-templates')
      .download(templateFileName);

    if (downloadError) {
      throw new Error(`Failed to download template: ${downloadError.message}`);
    }

    // Save the template locally
    const localTemplatePath = `./${templateFileName}`;
    const arrayBuffer = await templateBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(localTemplatePath, buffer);
    console.log(`✅ Template downloaded: ${localTemplatePath}`);

    // Contract data to replace placeholders
    const contractData = {
      clientName: 'John Doe',
      totalAmount: '$2,500',
      depositAmount: '$500',
      balanceAmount: '$2,000',
      date: new Date().toLocaleDateString(),
      initials: 'JD',
    };
    console.log('📝 Contract data:', contractData);

    // Replace placeholders using Docxtemplater
    console.log('🔄 Replacing placeholders using Docxtemplater...');
    const content = fs.readFileSync(localTemplatePath, 'binary');
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    doc.setData(contractData); // Set the data for replacement
    doc.render(); // Render the document

    const buf = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });

    const updatedTemplatePath = `./Labor Support Agreement Updated.docx`;
    fs.writeFileSync(updatedTemplatePath, buf);
    console.log(`✅ Updated template saved: ${updatedTemplatePath}`);

    // Authenticate with SignNow
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

    // Upload the updated template to SignNow
    console.log('📤 Uploading updated template to SignNow...');
    const formData = new FormData();
    formData.append('file', fs.createReadStream(updatedTemplatePath), {
      filename: 'Labor Support Agreement Updated.docx',
      contentType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

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
    console.log(
      `✅ Updated template uploaded to SignNow. Document ID: ${documentId}`
    );

    // Add fields with the correct coordinates we extracted
    console.log('🔧 Adding fields with correct coordinates...');
    const fieldData = {
      client_timestamp: Math.floor(Date.now() / 1000),
      fields: [
        {
          page_number: 1,
          type: 'signature',
          name: 'Client Signature',
          role: 'Signer 1',
          required: true,
          height: 50,
          width: 200,
          x: 400,
          y: 700,
        },
        {
          page_number: 1,
          type: 'text',
          name: 'Date',
          role: 'Signer 1',
          required: true,
          height: 25,
          width: 150,
          x: 650,
          y: 700,
          label: 'Date',
        },
        {
          page_number: 1,
          type: 'text',
          name: 'Initials',
          role: 'Signer 1',
          required: true,
          height: 25,
          width: 100,
          x: 400,
          y: 650,
          label: 'Initials',
        },
        {
          page_number: 1,
          type: 'text',
          name: 'Client Name',
          role: 'Signer 1',
          required: true,
          height: 25,
          width: 200,
          x: 400,
          y: 600,
          label: 'Client Name',
        },
      ],
    };

    const fieldResponse = await axios.put(
      `https://api.signnow.com/document/${documentId}`,
      fieldData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Fields added with correct coordinates');

    // Wait a moment for the fields to be processed
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Verify the fields were added
    const verifyResponse = await axios.get(
      `https://api.signnow.com/document/${documentId}`,
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

    // Prefill the date field
    console.log('📝 Prefilling date field...');
    const prefillData = {
      client_timestamp: Math.floor(Date.now() / 1000),
      fields: [
        {
          page_number: 1,
          type: 'text',
          name: 'Date',
          role: 'Signer 1',
          required: true,
          height: 25,
          width: 150,
          x: 650,
          y: 700,
          label: 'Date',
          prefilled_text: contractData.date,
        },
      ],
    };

    const prefillResponse = await axios.put(
      `https://api.signnow.com/document/${documentId}`,
      prefillData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Date field prefilled');

    // Send signing invitation
    console.log('📤 Sending signing invitation...');
    const invitationData = {
      to: 'test@example.com',
      from: process.env.SIGNNOW_USERNAME,
      subject: 'Please sign your Labor Support Agreement',
      message:
        'Please review and sign your Labor Support Agreement. The document has been prepared with the necessary fields for completion.',
      redirect_to: 'https://example.com/success',
      decline_redirect_to: 'https://example.com/decline',
    };

    const invitationResponse = await axios.post(
      `https://api.signnow.com/document/${documentId}/invite`,
      invitationData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Invitation sent successfully!');
    console.log('Invitation ID:', invitationResponse.data.id);
    console.log('Document ID:', documentId);
    console.log(
      'SignNow URL:',
      `https://app.signnow.com/webapp/document/${documentId}`
    );

    // Clean up local files
    fs.unlinkSync(localTemplatePath);
    fs.unlinkSync(updatedTemplatePath);
    console.log(`🧹 Cleaned up local files`);

    return {
      success: true,
      documentId,
      invitationId: invitationResponse.data.id,
      contractData,
    };
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data || error.message,
    };
  }
}

// Run the script
uploadReplaceAndAddFields().then((result) => {
  if (result.success) {
    console.log(
      '\n🎉 Document upload, placeholder replacement, and field addition completed successfully!'
    );
    console.log('📋 Summary:');
    console.log(`- Document ID: ${result.documentId}`);
    console.log(`- Invitation ID: ${result.invitationId}`);
    console.log(`- Client: ${result.contractData.clientName}`);
    console.log(`- Total Amount: ${result.contractData.totalAmount}`);
    console.log(`- Deposit Amount: ${result.contractData.depositAmount}`);
    console.log(`- Balance Amount: ${result.contractData.balanceAmount}`);
    console.log(
      `- SignNow URL: https://app.signnow.com/webapp/document/${result.documentId}`
    );
  } else {
    console.log('\n❌ Document processing failed');
    console.log('Error:', result.error);
  }
});





