#!/usr/bin/env node

/**
 * Debug script for SignNow API issues
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:5050';

async function debugSignNow() {
  console.log('🔍 Debugging SignNow API Issues');
  console.log('=' .repeat(50));

  try {
    // Step 1: Test authentication
    console.log('🔐 Step 1: Testing authentication...');
    const authResponse = await axios.post(`${API_BASE_URL}/api/signnow/test-auth`);

    if (authResponse.data.success) {
      console.log('✅ Authentication successful');
      console.log(`👤 User: ${authResponse.data.data.primary_email}`);
      console.log(`📊 Document count: ${authResponse.data.data.lifetime_document_count}`);
    } else {
      console.log('❌ Authentication failed');
      return;
    }

    console.log('');

    // Step 2: Try to upload a simple test file first
    console.log('📤 Step 2: Testing simple invitation creation...');

    // Test existing SignNow endpoints
    const testPayload = {
      client: {
        email: 'jerrybony5@gmail.com',
        name: 'Jerry Bony'
      },
      subject: 'Test Contract',
      message: 'Please sign this test document'
    };

    console.log('📋 Test payload:', JSON.stringify(testPayload, null, 2));

    const inviteResponse = await axios.post(`${API_BASE_URL}/api/signnow/send-client-partner`, testPayload);

    if (inviteResponse.data.success) {
      console.log('✅ Invitation created successfully');
      console.log('📄 Document ID:', inviteResponse.data.invite?.document_id);
    } else {
      console.log('❌ Invitation failed:', inviteResponse.data.error);
    }

  } catch (error) {
    console.error('❌ Debug failed:', error.response?.data || error.message);

    if (error.response?.data?.errors) {
      console.error('📋 Detailed errors:');
      error.response.data.errors.forEach((err, index) => {
        console.error(`  ${index + 1}. Code: ${err.code}, Message: ${err.message}`);
      });
    }
  }

  console.log('');
  console.log('=' .repeat(50));
  console.log('🏁 Debug completed');
}

// Run the debug
debugSignNow().catch(console.error);
