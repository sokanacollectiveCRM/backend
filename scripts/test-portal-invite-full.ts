/**
 * Comprehensive test script for Portal Invite endpoints
 * Tests eligibility checks, error handling, and endpoint structure
 */

import dotenv from 'dotenv';
import supabase from '../src/supabase';

dotenv.config();

const API_BASE_URL = process.env.API_URL || 'http://localhost:5050';
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || '';

interface LoginResponse {
  accessToken?: string;
  token?: string;
  user?: {
    id: string;
    email: string;
    role: string;
  };
  error?: string;
}

async function login(): Promise<string> {
  console.log('🔐 Logging in as admin...');
  console.log(`   Email: ${ADMIN_EMAIL}`);

  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Login failed: ${error.message || response.statusText}`);
  }

  const data: LoginResponse = await response.json();

  // Handle both token formats
  const token = data.accessToken || data.token;
  if (!token) {
    throw new Error('No access token received');
  }

  console.log('✅ Login successful\n');
  return token;
}

async function checkMigration(): Promise<boolean> {
  console.log('🔍 Checking if portal migration has been run...');

  try {
    const { data, error } = await supabase
      .from('client_info')
      .select('portal_status')
      .limit(1);

    if (error) {
      if (error.message.includes('column') && error.message.includes('portal_status')) {
        console.log('❌ Migration not run: portal_status column does not exist');
        console.log('   Please run: src/db/migrations/add_portal_invite_fields.sql\n');
        return false;
      }
      throw error;
    }

    console.log('✅ Migration appears to be run (portal_status column exists)\n');
    return true;
  } catch (error: any) {
    console.error('❌ Error checking migration:', error.message);
    return false;
  }
}

async function findTestClient(): Promise<string | null> {
  console.log('🔍 Finding a test client...');

  try {
    const { data: clients, error } = await supabase
      .from('client_info')
      .select('id, email, firstname, lastname')
      .limit(5);

    if (error) {
      throw new Error(`Failed to fetch clients: ${error.message}`);
    }

    if (!clients || clients.length === 0) {
      console.log('❌ No clients found in database');
      return null;
    }

    const client = clients[0];
    console.log(`✅ Found test client:`);
    console.log(`   ID: ${client.id}`);
    console.log(`   Name: ${client.firstname || ''} ${client.lastname || ''}`.trim() || 'N/A');
    console.log(`   Email: ${client.email || 'N/A'}\n`);

    return client.id;
  } catch (error: any) {
    console.error('❌ Error finding client:', error.message);
    return null;
  }
}

async function testInviteEndpoint(clientId: string, token: string): Promise<void> {
  console.log(`📧 Testing invite endpoint for client ${clientId}...`);

  const response = await fetch(`${API_BASE_URL}/api/admin/clients/${clientId}/portal/invite`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  const contentType = response.headers.get('content-type');
  let data: any;

  if (contentType?.includes('application/json')) {
    data = await response.json();
  } else {
    const text = await response.text();
    console.log(`   ⚠️  Non-JSON response received (${contentType})`);
    console.log(`   Response preview: ${text.substring(0, 200)}...`);
    return;
  }

  console.log(`   Status: ${response.status} ${response.statusText}`);
  console.log(`   Response:`, JSON.stringify(data, null, 2));

  if (response.ok) {
    console.log('✅ Invite endpoint is working!');
  } else {
    if (data.error?.code === 'NOT_ELIGIBLE') {
      console.log('ℹ️  Expected: Client is not eligible (needs signed contract + completed first payment)');
    } else if (data.error?.code === 'NOT_FOUND') {
      console.log('ℹ️  Client not found');
    } else {
      console.log(`⚠️  Error: ${data.error?.code || 'UNKNOWN'} - ${data.error?.message || data.message || 'Unknown error'}`);
    }
  }
  console.log('');
}

async function testResendEndpoint(clientId: string, token: string): Promise<void> {
  console.log(`📧 Testing resend endpoint for client ${clientId}...`);

  const response = await fetch(`${API_BASE_URL}/api/admin/clients/${clientId}/portal/resend`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  const contentType = response.headers.get('content-type');
  let data: any;

  if (contentType?.includes('application/json')) {
    data = await response.json();
  } else {
    const text = await response.text();
    console.log(`   ⚠️  Non-JSON response received (${contentType})`);
    console.log(`   Response preview: ${text.substring(0, 200)}...`);
    return;
  }

  console.log(`   Status: ${response.status} ${response.statusText}`);
  console.log(`   Response:`, JSON.stringify(data, null, 2));

  if (response.ok) {
    console.log('✅ Resend endpoint is working!');
  } else {
    console.log(`ℹ️  Expected error (client likely not eligible or not invited yet)`);
  }
  console.log('');
}

async function testDisableEndpoint(clientId: string, token: string): Promise<void> {
  console.log(`🚫 Testing disable endpoint for client ${clientId}...`);

  const response = await fetch(`${API_BASE_URL}/api/admin/clients/${clientId}/portal/disable`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  const contentType = response.headers.get('content-type');
  let data: any;

  if (contentType?.includes('application/json')) {
    data = await response.json();
  } else {
    const text = await response.text();
    console.log(`   ⚠️  Non-JSON response received (${contentType})`);
    console.log(`   Response preview: ${text.substring(0, 200)}...`);
    return;
  }

  console.log(`   Status: ${response.status} ${response.statusText}`);
  console.log(`   Response:`, JSON.stringify(data, null, 2));

  if (response.ok) {
    console.log('✅ Disable endpoint is working!');
  } else {
    console.log(`⚠️  Error: ${data.error?.message || 'Unknown error'}`);
  }
  console.log('');
}

async function main() {
  console.log('🚀 Portal Invite Feature Test Suite\n');
  console.log('='.repeat(60) + '\n');

  try {
    // Step 1: Check migration
    const migrationOk = await checkMigration();
    if (!migrationOk) {
      console.log('⚠️  Cannot proceed without migration. Please run the migration first.');
      process.exit(1);
    }

    // Step 2: Login
    const token = await login();

    // Step 3: Find a test client
    const clientId = await findTestClient();
    if (!clientId) {
      console.log('❌ Cannot proceed without a test client');
      process.exit(1);
    }

    // Step 4: Test endpoints
    console.log('🧪 Testing Portal Invite Endpoints\n');
    console.log('-'.repeat(60) + '\n');

    await testInviteEndpoint(clientId, token);
    await testResendEndpoint(clientId, token);
    await testDisableEndpoint(clientId, token);

    console.log('='.repeat(60));
    console.log('✅ Test suite completed!');
    console.log('\n💡 Note: If you see NOT_ELIGIBLE errors, that\'s expected.');
    console.log('   To test full flow, you need a client with:');
    console.log('   1. Signed contract (status = "signed")');
    console.log('   2. Completed first payment (deposit, status = "succeeded")');

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
