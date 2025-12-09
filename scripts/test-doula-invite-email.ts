/**
 * Test script to send a doula invitation email
 * This tests the admin invite doula endpoint and email sending
 *
 * Usage: npx tsx scripts/test-doula-invite-email.ts
 */

import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5050';
const API_BASE = `${BASE_URL}/api`;

// Test credentials - update these or use env vars
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'jerrybony5@gmail.com';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'your-admin-password';

// Test doula invite data
const TEST_DOULA_EMAIL = process.env.TEST_INVITE_EMAIL || 'info@techluminateacademy.com';
const TEST_FIRSTNAME = process.env.TEST_INVITE_FIRSTNAME || 'Test';
const TEST_LASTNAME = process.env.TEST_INVITE_LASTNAME || 'Doula';

interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
}

async function testDoulaInviteEmail() {
  console.log('🧪 Testing Doula Invite Email Endpoint\n');
  console.log('📋 Configuration:');
  console.log(`   API Base: ${API_BASE}`);
  console.log(`   Admin Email: ${ADMIN_EMAIL}`);
  console.log(`   Test Doula Email: ${TEST_DOULA_EMAIL}`);
  console.log(`   Test Doula Name: ${TEST_FIRSTNAME} ${TEST_LASTNAME}\n`);

  try {
    // Step 1: Login as admin
    console.log('📝 Step 1: Logging in as admin...');
    const loginResponse = await axios.post<LoginResponse>(`${BASE_URL}/auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });

    if (!loginResponse.data.token) {
      throw new Error('No token received from login');
    }

    const adminToken = loginResponse.data.token;
    console.log('✅ Admin logged in successfully');
    console.log(`   User: ${loginResponse.data.user.email}`);
    console.log(`   Role: ${loginResponse.data.user.role}\n`);

    if (loginResponse.data.user.role !== 'admin') {
      console.warn('⚠️  Warning: User is not an admin. Invite may fail.\n');
    }

    // Step 2: Send doula invite
    console.log('📝 Step 2: Sending doula invitation email...');
    console.log(`   To: ${TEST_DOULA_EMAIL}`);
    console.log(`   Name: ${TEST_FIRSTNAME} ${TEST_LASTNAME}\n`);

    const inviteResponse = await axios.post(
      `${API_BASE}/admin/doulas/invite`,
      {
        email: TEST_DOULA_EMAIL,
        firstname: TEST_FIRSTNAME,
        lastname: TEST_LASTNAME,
      },
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (inviteResponse.data.success) {
      console.log('✅ Invitation email sent successfully!\n');
      console.log('📧 Email Details:');
      console.log(`   Recipient: ${inviteResponse.data.data.email}`);
      console.log(`   Name: ${inviteResponse.data.data.firstname} ${inviteResponse.data.data.lastname}`);
      console.log(`   Invite Token: ${inviteResponse.data.data.inviteToken}`);
      console.log(`   Message: ${inviteResponse.data.message}\n`);

      // Check if test mode is enabled
      if (process.env.USE_TEST_EMAIL === 'true') {
        console.log('⚠️  TEST MODE: Email was logged but NOT actually sent');
        console.log('   Check server logs for email content\n');
      } else {
        console.log('✅ Email should have been sent via SMTP');
        console.log(`   Check inbox: ${TEST_DOULA_EMAIL}`);
        console.log('   Subject: "Welcome to the Sokana Doula Team!"\n');
      }

      console.log('📋 Next Steps:');
      console.log('   1. Check the doula\'s email inbox');
      console.log('   2. Verify the email was received');
      console.log('   3. Check the signup link in the email');
      console.log('   4. Verify the link includes role=doula and email parameters\n');

      return true;
    } else {
      throw new Error('Invite response indicates failure');
    }
  } catch (error: any) {
    console.error('\n❌ Error testing doula invite:');

    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Error: ${JSON.stringify(error.response.data, null, 2)}`);

      if (error.response.status === 401) {
        console.error('\n💡 Tip: Check your admin credentials');
      } else if (error.response.status === 403) {
        console.error('\n💡 Tip: Ensure the user has admin role');
      } else if (error.response.status === 500) {
        console.error('\n💡 Tip: Check email configuration in .env file');
        console.error('   Required: EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASSWORD');
      }
    } else if (error.request) {
      console.error('   Network error: Could not reach server');
      console.error(`   URL: ${API_BASE}`);
      console.error('\n💡 Tip: Make sure the server is running (npm start)');
    } else {
      console.error(`   Error: ${error.message}`);
    }

    return false;
  }
}

// Run the test
testDoulaInviteEmail()
  .then((success) => {
    if (success) {
      console.log('✅ Test completed successfully!');
      process.exit(0);
    } else {
      console.log('❌ Test failed');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });
