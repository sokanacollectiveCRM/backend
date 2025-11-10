// Test SignNow Authentication
// This script tests the SignNow authentication to identify the issue
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testSignNowAuth() {
  try {
    console.log('🔍 TESTING SIGNNOW AUTHENTICATION\n');

    // Check environment variables
    console.log('📋 SignNow Configuration:');
    console.log(`   🔗 Base URL: ${process.env.SIGNNOW_BASE_URL || 'NOT SET'}`);
    console.log(
      `   🔑 Client ID: ${process.env.SIGNNOW_CLIENT_ID ? 'SET' : 'NOT SET'}`
    );
    console.log(
      `   🔐 Client Secret: ${process.env.SIGNNOW_CLIENT_SECRET ? 'SET' : 'NOT SET'}`
    );
    console.log(
      `   👤 Username: ${process.env.SIGNNOW_USERNAME ? 'SET' : 'NOT SET'}`
    );
    console.log(
      `   🔒 Password: ${process.env.SIGNNOW_PASSWORD ? 'SET' : 'NOT SET'}`
    );

    // SignNow API configuration
    const SIGNNOW_BASE_URL =
      process.env.SIGNNOW_BASE_URL || 'https://api-eval.signnow.com';
    const SIGNNOW_CLIENT_ID = process.env.SIGNNOW_CLIENT_ID;
    const SIGNNOW_CLIENT_SECRET = process.env.SIGNNOW_CLIENT_SECRET;
    const SIGNNOW_USERNAME = process.env.SIGNNOW_USERNAME;
    const SIGNNOW_PASSWORD = process.env.SIGNNOW_PASSWORD;

    console.log('\n🔐 Testing SignNow Authentication...');

    if (
      !SIGNNOW_CLIENT_ID ||
      !SIGNNOW_CLIENT_SECRET ||
      !SIGNNOW_USERNAME ||
      !SIGNNOW_PASSWORD
    ) {
      throw new Error(
        'Missing SignNow credentials. Please check your .env file.'
      );
    }

    const authData = {
      grant_type: 'password',
      username: SIGNNOW_USERNAME,
      password: SIGNNOW_PASSWORD,
      scope: '*',
    };

    console.log('\n📤 Sending authentication request...');
    console.log(`   🔗 URL: ${SIGNNOW_BASE_URL}/oauth2/token`);
    console.log(`   👤 Username: ${SIGNNOW_USERNAME}`);
    console.log(`   🔑 Client ID: ${SIGNNOW_CLIENT_ID}`);

    const response = await fetch(`${SIGNNOW_BASE_URL}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${SIGNNOW_CLIENT_ID}:${SIGNNOW_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams(authData),
    });

    console.log(
      `\n📊 Response Status: ${response.status} ${response.statusText}`
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ Error Response: ${errorText}`);

      if (response.status === 400) {
        console.log('\n💡 Troubleshooting 400 Bad Request:');
        console.log('   1. Check if SignNow credentials are correct');
        console.log('   2. Verify the SignNow environment (eval vs prod)');
        console.log('   3. Ensure the username/password are valid');
        console.log('   4. Check if the client ID/secret are correct');
        console.log('   5. Verify the SignNow base URL is correct');
      }

      throw new Error(
        `SignNow authentication failed: ${response.status} ${response.statusText}`
      );
    }

    const tokenData = await response.json();
    console.log('✅ SignNow authentication successful!');
    console.log(
      `   🔑 Access Token: ${tokenData.access_token ? 'RECEIVED' : 'NOT RECEIVED'}`
    );

    return tokenData.access_token;
  } catch (error) {
    console.error('❌ SignNow authentication test failed:', error);
    throw error;
  }
}

// Run the authentication test
testSignNowAuth().catch(console.error);





