require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

async function processContractFromSupabase() {
  try {
    console.log('🔍 Processing contract from Supabase...');

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
      initials: 'JD'
    };

    console.log('📝 Contract data:', contractData);

    // For now, we'll upload the template as-is to SignNow
    // In a real implementation, you'd replace placeholders in the DOCX
    console.log('📤 Uploading template to SignNow...');

    // Get SignNow auth token
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

    // Upload the template to SignNow
    const formData = new FormData();
    formData.append('file', fs.createReadStream(localTemplatePath), {
      filename: templateFileName,
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
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
    console.log(`✅ Template uploaded to SignNow. Document ID: ${documentId}`);

    // Add signature and date fields to the document
    console.log('🔧 Adding signature and date fields...');
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
          x: 300,
          y: 650,
        },
        {
          page_number: 1,
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

    console.log('✅ Fields added successfully');

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
          x: 500,
          y: 650,
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

    // Send invitation for signing
    console.log('📤 Sending signing invitation...');
    const invitationData = {
      to: 'test@example.com',
      from: process.env.SIGNNOW_USERNAME,
      subject: 'Please sign your Labor Support Agreement',
      message: `Please review and sign your Labor Support Agreement for ${contractData.clientName}. The total amount is ${contractData.totalAmount} with a deposit of ${contractData.depositAmount}.`,
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
    console.log('SignNow URL:', `https://app.signnow.com/webapp/document/${documentId}`);

    // Clean up local file
    fs.unlinkSync(localTemplatePath);
    console.log('🧹 Cleaned up local template file');

    return {
      success: true,
      documentId,
      invitationId: invitationResponse.data.id,
      contractData
    };

  } catch (error) {
    console.error('❌ Error processing contract:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data || error.message
    };
  }
}

// Run the script
processContractFromSupabase().then(result => {
  if (result.success) {
    console.log('\n🎉 Contract processing completed successfully!');
    console.log('📋 Summary:');
    console.log(`- Document ID: ${result.documentId}`);
    console.log(`- Invitation ID: ${result.invitationId}`);
    console.log(`- Client: ${result.contractData.clientName}`);
    console.log(`- Total Amount: ${result.contractData.totalAmount}`);
  } else {
    console.log('\n❌ Contract processing failed');
    console.log('Error:', result.error);
  }
});
