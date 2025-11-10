require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const Docxtemplater = require('docxtemplater');
const JSZip = require('jszip');

async function uploadDocxWithPlaceholdersReplaced() {
  try {
    console.log('🔍 Downloading template, replacing placeholders, and uploading DOCX directly...');

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

    // Use our Labor Support template
    const templateId = '6af732001d7944ee83cb6dde81846c3e83c241d8';

    // Download the template document
    console.log('📄 Downloading template document...');
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

    // Replace placeholders in the DOCX
    console.log('🔧 Replacing placeholders with actual values...');
    
    const zip = await JSZip.loadAsync(downloadResponse.data);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    // Sample contract data
    const contractData = {
      clientName: 'Jane Smith',
      clientEmail: 'jane.smith@example.com',
      serviceType: 'Labor Support Doula Services',
      totalInvestment: '$2,500.00',
      depositAmount: '$500.00',
      remainingBalance: '$2,000.00',
      contractDate: new Date().toLocaleDateString(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      totalHours: '40',
      hourlyRate: '50.00',
      overnightFee: '0.00',
    };

    // Map to template variables
    const templateVariables = {
      totalAmount: contractData.totalInvestment,
      depositAmount: contractData.depositAmount,
      balanceAmount: contractData.remainingBalance,
      clientName: contractData.clientName,
      client_initials: contractData.clientName.split(' ').map(n => n[0]).join(''),
      client_signature: '',
      client_signed_date: '',
      serviceType: contractData.serviceType,
      totalInvestment: contractData.totalInvestment,
      remainingBalance: contractData.remainingBalance,
      contractDate: contractData.contractDate,
      dueDate: contractData.dueDate,
      startDate: contractData.startDate,
      endDate: contractData.endDate,
      totalHours: contractData.totalHours,
      hourlyRate: contractData.hourlyRate,
      overnightFee: contractData.overnightFee,
    };

    console.log('📋 Template variables being used:', templateVariables);

    // Set data and render
    doc.setData(templateVariables);
    doc.render();

    // Generate the modified DOCX
    const modifiedDocx = await doc.getZip().generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 1,
      },
    });

    console.log('✅ Placeholders replaced successfully');

    // Upload the modified DOCX directly to SignNow
    const FormData = require('form-data');
    const form = new FormData();
    form.append('file', modifiedDocx, {
      filename: 'Labor Support Agreement - With Placeholders Replaced.docx',
      contentType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    console.log('📤 Uploading modified DOCX to SignNow...');
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
    console.log(`✅ Modified DOCX uploaded: ${newDocumentId}`);

    // Wait for document to be processed
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Add fields with our target coordinates
    console.log('🔧 Adding fields with target coordinates...');

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
          x: 380, // Target x coordinate
          y: 220, // Target y coordinate
        },
        {
          page_number: 2, // Last page (0-based indexing)
          type: 'text',
          name: 'Date',
          role: 'Signer 1',
          required: true,
          height: 25,
          width: 150,
          x: 100, // Target x coordinate
          y: 275, // Target y coordinate
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

    console.log('✅ Fields added with target coordinates');

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

    console.log('\n📋 Contract with Placeholders Replaced:');
    console.log('=========================================');
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
      contractData: contractData,
    };
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    return null;
  }
}

// Run the script
uploadDocxWithPlaceholdersReplaced().then((result) => {
  if (result) {
    console.log(
      '\n🎉 DOCX with replaced placeholders uploaded successfully!'
    );
    console.log('✅ Placeholders replaced with actual values');
    console.log('✅ No PDF conversion - maintains original layout');
    console.log('✅ Fields positioned with target coordinates');
    console.log(`\n📄 Contract Details:`);
    console.log(`- ID: ${result.documentId}`);
    console.log(`- Name: ${result.documentName}`);
    console.log(`- URL: ${result.url}`);
    console.log(`- Client: ${result.contractData.clientName}`);
    console.log(`- Service: ${result.contractData.serviceType}`);
    console.log(`- Total: ${result.contractData.totalInvestment}`);
    console.log(
      '\n💡 This contract has real values and should be ready for signing!'
    );
  } else {
    console.log('\n❌ Failed to upload DOCX with replaced placeholders');
  }
});
