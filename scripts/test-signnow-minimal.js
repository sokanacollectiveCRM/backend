#!/usr/bin/env node

/**
 * Minimal test for SignNow field addition
 */

const axios = require('axios');
const fs = require('fs');

async function testMinimalSignNow() {
  console.log('🧪 Minimal SignNow Field Test');
  console.log('=' .repeat(40));

  try {
    // Step 1: Upload a test document first
    console.log('📤 Step 1: Uploading test document...');

    // Read a test PDF from our generated folder
    const testFiles = fs.readdirSync('./generated').filter(f => f.endsWith('.pdf'));
    if (testFiles.length === 0) {
      throw new Error('No test PDF files found in ./generated');
    }

    const testPdf = testFiles[0];
    console.log(`📄 Using test file: ${testPdf}`);

    // Upload via our API
    const uploadResponse = await axios.post('http://localhost:5050/api/contract-signing/test-send');

    if (!uploadResponse.data.success) {
      console.error('❌ Upload failed:', uploadResponse.data);
      return;
    }

    console.log('✅ Upload successful');
    console.log('Response:', JSON.stringify(uploadResponse.data, null, 2));

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }

  console.log('');
  console.log('=' .repeat(40));
  console.log('🏁 Test completed');
}

// Run the test
testMinimalSignNow().catch(console.error);
