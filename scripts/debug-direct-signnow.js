#!/usr/bin/env node

/**
 * Direct SignNow API test to debug the 400 error
 */

const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

async function directSignNowTest() {
  console.log('🔍 Direct SignNow API Debug');
  console.log('=' .repeat(50));

  try {
    // Step 1: Get auth token
    console.log('🔐 Step 1: Getting auth token...');

    const authParams = new URLSearchParams({
      grant_type: 'password',
      client_id: process.env.SIGNNOW_CLIENT_ID,
      client_secret: process.env.SIGNNOW_CLIENT_SECRET,
      username: process.env.SIGNNOW_USERNAME,
      password: process.env.SIGNNOW_PASSWORD
    });

    const authResponse = await axios.post(
      'https://api.signnow.com/oauth2/token',
      authParams.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const token = authResponse.data.access_token;
    console.log('✅ Auth successful, token:', token.substring(0, 20) + '...');

    // Step 2: Upload a document
    console.log('📤 Step 2: Uploading document...');

    const testFiles = fs.readdirSync('./generated').filter(f => f.endsWith('.pdf'));
    if (testFiles.length === 0) {
      throw new Error('No test PDF files found in ./generated');
    }

    const testPdf = testFiles[0];
    console.log(`📄 Using: ${testPdf}`);

    const fileBuffer = fs.readFileSync(`./generated/${testPdf}`);
    const formData = new FormData();
    formData.append('file', fileBuffer, testPdf);

    const uploadResponse = await axios.post(
      'https://api.signnow.com/document',
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          ...formData.getHeaders()
        }
      }
    );

    const documentId = uploadResponse.data.id;
    console.log('✅ Upload successful, documentId:', documentId);

    // Step 3: Try to add ONE simple signature field
    console.log('✍️ Step 3: Adding signature field...');

    const fieldData = {
      client_timestamp: Math.floor(Date.now() / 1000),
      fields: [
        {
          page_number: 0,
          type: "signature",
          name: "signature_field_1",
          role: "Signer 1",
          required: true,
          height: 50,
          width: 200,
          x: 100,
          y: 600
        }
      ]
    };

    console.log('📋 Field data:', JSON.stringify(fieldData, null, 2));

    const fieldResponse = await axios.put(
      `https://api.signnow.com/document/${documentId}`,
      fieldData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Fields added successfully');
    console.log('Response:', fieldResponse.data);

    // Step 4: Send invitation
    console.log('📧 Step 4: Sending invitation...');

    const inviteData = {
      document_id: documentId,
      to: [
        {
          email: "jerrybony5@gmail.com",
          role: "Signer 1",
          order: 1
        }
      ],
      subject: "Test Contract - Please Sign",
      message: "Please sign this test contract.",
      from: "jerry@techluminateacademy.com"
    };

    const inviteResponse = await axios.post(
      `https://api.signnow.com/document/${documentId}/invite`,
      inviteData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Invitation sent successfully');
    console.log('Response:', inviteResponse.data);

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
      console.error('Headers:', error.response.headers);
    }
  }

  console.log('');
  console.log('=' .repeat(50));
  console.log('🏁 Debug completed');
}

// Run the debug
directSignNowTest().catch(console.error);
