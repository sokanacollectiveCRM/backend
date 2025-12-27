require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const Docxtemplater = require('docxtemplater');
const PizZip = require('pizzip');

async function uploadContractWithDocxTemplater() {
  try {
    console.log('🔍 Processing contract with proper DOCX templating...');

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

    // Use Docxtemplater to properly replace placeholders
    console.log('🔄 Replacing placeholders using Docxtemplater...');

    // Load the DOCX file
    const content = fs.readFileSync(localTemplatePath, 'binary');
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    // Set the template variables
    doc.setData(contractData);

    try {
      // Render the document
      doc.render();
    } catch (error) {
      console.error('❌ Error rendering template:', error);
      throw error;
    }

    // Generate the updated DOCX
    const buf = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 1,
      },
    });

    // Save the updated DOCX file
    const updatedTemplatePath = `./Labor Support Agreement Updated.docx`;
    fs.writeFileSync(updatedTemplatePath, buf);
    console.log(`✅ Updated template saved: ${updatedTemplatePath}`);

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

    // Clean up local files
    fs.unlinkSync(localTemplatePath);
    fs.unlinkSync(updatedTemplatePath);
    console.log('🧹 Cleaned up local files');

    return {
      success: true,
      documentId,
      contractData,
    };
  } catch (error) {
    console.error(
      '❌ Error processing contract:',
      error.response?.data || error.message
    );
    return {
      success: false,
      error: error.response?.data || error.message,
    };
  }
}

// Run the script
uploadContractWithDocxTemplater().then((result) => {
  if (result.success) {
    console.log('\n🎉 Contract processing completed successfully!');
    console.log('📋 Summary:');
    console.log(`- Document ID: ${result.documentId}`);
    console.log(`- Client: ${result.contractData.clientName}`);
    console.log(`- Total Amount: ${result.contractData.totalAmount}`);
    console.log(`- Deposit Amount: ${result.contractData.depositAmount}`);
    console.log(`- Balance Amount: ${result.contractData.balanceAmount}`);
    console.log(
      `- SignNow URL: https://app.signnow.com/webapp/document/${result.documentId}`
    );
  } else {
    console.log('\n❌ Contract processing failed');
    console.log('Error:', result.error);
  }
});






