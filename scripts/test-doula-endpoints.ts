/**
 * Test script for Doula Management Endpoints
 *
 * Usage: npx tsx scripts/test-doula-endpoints.ts
 *
 * Prerequisites:
 * 1. Run the database migration: src/db/migrations/create_doula_documents_table.sql
 * 2. Create Supabase Storage bucket: doula-documents
 * 3. Set environment variables in .env file
 * 4. Have test users: one admin and one doula user
 */

import dotenv from 'dotenv';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

dotenv.config();

const BASE_URL = process.env.BACKEND_URL || process.env.FRONTEND_URL?.replace(':3001', ':5050') || 'http://localhost:5050';
const API_BASE = `${BASE_URL}/api`;

// Test credentials - UPDATE THESE with your test user credentials
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'admin@test.com';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'admin123';
const DOULA_EMAIL = process.env.TEST_DOULA_EMAIL || 'jerry@techluminateacademy.com';
const DOULA_PASSWORD = process.env.TEST_DOULA_PASSWORD || '@Bony5690';

// Log configuration
console.log('\n📋 Test Configuration:');
console.log(`   Base URL: ${BASE_URL}`);
console.log(`   Admin Email: ${ADMIN_EMAIL}`);
console.log(`   Doula Email: ${DOULA_EMAIL}`);
console.log(`   Using env vars: ${process.env.TEST_ADMIN_EMAIL ? 'Yes' : 'No (using defaults)'}\n`);

// Test data
let adminToken: string = '';
let doulaToken: string = '';
let doulaId: string = '';
let clientId: string = '';
let documentId: string = '';
let assignmentId: string = '';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message: string) {
  log(`✅ ${message}`, 'green');
}

function logError(message: string) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message: string) {
  log(`ℹ️  ${message}`, 'cyan');
}

function logTest(message: string) {
  log(`\n🧪 ${message}`, 'blue');
}

/**
 * Helper function to make authenticated requests
 */
async function makeRequest(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  endpoint: string,
  token: string,
  data?: any,
  isFormData: boolean = false
) {
  const config: any = {
    method,
    url: `${API_BASE}${endpoint}`,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  if (data) {
    if (isFormData) {
      config.data = data;
      config.headers = {
        ...config.headers,
        ...data.getHeaders(),
      };
    } else {
      config.data = data;
      config.headers['Content-Type'] = 'application/json';
    }
  }

  try {
    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status || 500,
    };
  }
}

/**
 * Test 0: Check Server Connection
 */
async function testServerConnection() {
  logTest('Test 0: Check Server Connection');
  try {
    const response = await axios.get(`${BASE_URL}/`, { timeout: 5000 });
    if (response.status === 200) {
      logSuccess('Server is running and accessible');
      return true;
    } else {
      logError(`Server returned status ${response.status}`);
      return false;
    }
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED') {
      logError(`Cannot connect to server at ${BASE_URL}`);
      logInfo('Make sure the server is running: npm start');
    } else if (error.code === 'ETIMEDOUT') {
      logError(`Connection timeout to ${BASE_URL}`);
    } else {
      logError(`Connection error: ${error.message}`);
    }
    return false;
  }
}

/**
 * Test 1: Admin Login
 */
async function testAdminLogin() {
  logTest('Test 1: Admin Login');
  try {
    logInfo(`Attempting login with email: ${ADMIN_EMAIL}`);
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    }, { timeout: 10000 });

    if (response.data.token) {
      adminToken = response.data.token;
      logSuccess(`Admin logged in successfully. Token: ${adminToken.substring(0, 20)}...`);
      return true;
    } else {
      logError('Admin login failed: No token received');
      logInfo(`Response: ${JSON.stringify(response.data, null, 2)}`);
      return false;
    }
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED') {
      logError(`Cannot connect to server at ${BASE_URL}`);
      logInfo('Make sure the server is running: npm start');
    } else if (error.response) {
      logError(`Admin login failed: ${error.response.status} ${error.response.statusText}`);
      logError(`Error details: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      logError(`Admin login failed: ${error.message}`);
    }
    return false;
  }
}

/**
 * Test 2: Doula Login
 */
async function testDoulaLogin() {
  logTest('Test 2: Doula Login');
  try {
    logInfo(`Attempting login with email: ${DOULA_EMAIL}`);
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      email: DOULA_EMAIL,
      password: DOULA_PASSWORD,
    }, { timeout: 10000 });

    if (response.data.token) {
      doulaToken = response.data.token;
      doulaId = response.data.user?.id || '';
      logSuccess(`Doula logged in successfully. Token: ${doulaToken.substring(0, 20)}...`);
      logInfo(`Doula ID: ${doulaId}`);
      return true;
    } else {
      logError('Doula login failed: No token received');
      logInfo(`Response: ${JSON.stringify(response.data, null, 2)}`);
      return false;
    }
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED') {
      logError(`Cannot connect to server at ${BASE_URL}`);
      logInfo('Make sure the server is running: npm start');
    } else if (error.response) {
      logError(`Doula login failed: ${error.response.status} ${error.response.statusText}`);
      logError(`Error details: ${JSON.stringify(error.response.data, null, 2)}`);
      if (error.response.status === 401 || error.response.status === 404) {
        logInfo('Note: You may need to create a doula user first or update TEST_DOULA_EMAIL in .env');
        logInfo('To create a doula user, sign up with role "doula" or use the admin panel');
      }
    } else {
      logError(`Doula login failed: ${error.message}`);
    }
    return false;
  }
}

/**
 * Test 3: Admin Invite Doula
 */
async function testInviteDoula() {
  logTest('Test 3: Admin Invite Doula');
  const testEmail = `test-doula-${Date.now()}@test.com`;
  const result = await makeRequest(
    'POST',
    '/admin/doulas/invite',
    adminToken,
    {
      email: testEmail,
      firstname: 'Test',
      lastname: 'Doula',
    }
  );

  if (result.success) {
    logSuccess(`Invitation sent to ${testEmail}`);
    logInfo(`Response: ${JSON.stringify(result.data, null, 2)}`);
    return true;
  } else {
    logError(`Failed to invite doula: ${JSON.stringify(result.error, null, 2)}`);
    return false;
  }
}

/**
 * Test 4: Upload Document
 */
async function testUploadDocument() {
  logTest('Test 4: Upload Document');

  // Create a test file
  const testFilePath = path.join(__dirname, '../temp', 'test-document.pdf');
  const testDir = path.dirname(testFilePath);

  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  // Create a simple PDF-like file (or use a real test file)
  fs.writeFileSync(testFilePath, 'Test PDF Content');

  const formData = new FormData();
  formData.append('file', fs.createReadStream(testFilePath), {
    filename: 'test-document.pdf',
    contentType: 'application/pdf',
  });
  formData.append('document_type', 'background_check');
  formData.append('notes', 'Test background check document');

  const result = await makeRequest('POST', '/doulas/documents', doulaToken, formData, true);

  if (result.success && result.data.document) {
    documentId = result.data.document.id;
    logSuccess(`Document uploaded successfully. ID: ${documentId}`);
    logInfo(`File URL: ${result.data.document.fileUrl}`);

    // Clean up test file
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
    return true;
  } else {
    logError(`Failed to upload document: ${JSON.stringify(result.error, null, 2)}`);
    return false;
  }
}

/**
 * Test 5: Get My Documents
 */
async function testGetMyDocuments() {
  logTest('Test 5: Get My Documents');
  const result = await makeRequest('GET', '/doulas/documents', doulaToken);

  if (result.success) {
    logSuccess(`Retrieved ${result.data.documents?.length || 0} documents`);
    if (result.data.documents && result.data.documents.length > 0) {
      logInfo(`Sample document: ${JSON.stringify(result.data.documents[0], null, 2)}`);
    }
    return true;
  } else {
    logError(`Failed to get documents: ${JSON.stringify(result.error, null, 2)}`);
    return false;
  }
}

/**
 * Test 6: Get My Clients (Assigned)
 */
async function testGetMyClients() {
  logTest('Test 6: Get My Clients');
  const result = await makeRequest('GET', '/doulas/clients', doulaToken);

  if (result.success) {
    const clients = result.data.clients || [];
    logSuccess(`Retrieved ${clients.length} assigned clients`);
    if (clients.length > 0) {
      clientId = clients[0].id;
      logInfo(`Sample client ID: ${clientId}`);
      logInfo(`Client name: ${clients[0].user?.firstname} ${clients[0].user?.lastname}`);
    } else {
      logInfo('No clients assigned yet. You may need to assign a client first.');
    }
    return true;
  } else {
    logError(`Failed to get clients: ${JSON.stringify(result.error, null, 2)}`);
    return false;
  }
}

/**
 * Test 7: Get Client Details
 */
async function testGetClientDetails() {
  logTest('Test 7: Get Client Details');

  if (!clientId) {
    logInfo('Skipping - No client ID available. Run test 6 first or assign a client.');
    return true;
  }

  const result = await makeRequest('GET', `/doulas/clients/${clientId}`, doulaToken);

  if (result.success) {
    logSuccess(`Retrieved client details for ${clientId}`);
    logInfo(`Client: ${JSON.stringify(result.data.client?.user, null, 2)}`);
    return true;
  } else {
    logError(`Failed to get client details: ${JSON.stringify(result.error, null, 2)}`);
    return false;
  }
}

/**
 * Test 8: Log Hours
 */
async function testLogHours() {
  logTest('Test 8: Log Hours');

  if (!clientId) {
    logInfo('Skipping - No client ID available. Run test 6 first or assign a client.');
    return true;
  }

  const startTime = new Date();
  const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000); // 2 hours later

  const result = await makeRequest(
    'POST',
    '/doulas/hours',
    doulaToken,
    {
      client_id: clientId,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      note: 'Test hours log entry',
    }
  );

  if (result.success) {
    logSuccess('Hours logged successfully');
    logInfo(`Work entry: ${JSON.stringify(result.data.workEntry, null, 2)}`);
    return true;
  } else {
    logError(`Failed to log hours: ${JSON.stringify(result.error, null, 2)}`);
    if (result.status === 403) {
      logInfo('This error is expected if the client is not assigned to the doula.');
    }
    return false;
  }
}

/**
 * Test 9: Get My Hours
 */
async function testGetMyHours() {
  logTest('Test 9: Get My Hours');
  const result = await makeRequest('GET', '/doulas/hours', doulaToken);

  if (result.success) {
    const hours = result.data.hours || [];
    logSuccess(`Retrieved ${hours.length} hours entries`);
    if (hours.length > 0) {
      logInfo(`Sample entry: ${JSON.stringify(hours[0], null, 2)}`);
    }
    return true;
  } else {
    logError(`Failed to get hours: ${JSON.stringify(result.error, null, 2)}`);
    return false;
  }
}

/**
 * Test 10: Add Client Activity
 */
async function testAddClientActivity() {
  logTest('Test 10: Add Client Activity');

  if (!clientId) {
    logInfo('Skipping - No client ID available. Run test 6 first or assign a client.');
    return true;
  }

  const result = await makeRequest(
    'POST',
    `/doulas/clients/${clientId}/activities`,
    doulaToken,
    {
      type: 'note_added',
      description: 'Test activity note',
      metadata: {
        category: 'test',
        priority: 'low',
      },
    }
  );

  if (result.success) {
    logSuccess('Activity added successfully');
    logInfo(`Activity: ${JSON.stringify(result.data.activity, null, 2)}`);
    return true;
  } else {
    logError(`Failed to add activity: ${JSON.stringify(result.error, null, 2)}`);
    if (result.status === 403) {
      logInfo('This error is expected if the client is not assigned to the doula.');
    }
    return false;
  }
}

/**
 * Test 11: Get Client Activities
 */
async function testGetClientActivities() {
  logTest('Test 11: Get Client Activities');

  if (!clientId) {
    logInfo('Skipping - No client ID available. Run test 6 first or assign a client.');
    return true;
  }

  const result = await makeRequest(
    'GET',
    `/doulas/clients/${clientId}/activities`,
    doulaToken
  );

  if (result.success) {
    const activities = result.data.activities || [];
    logSuccess(`Retrieved ${activities.length} activities`);
    if (activities.length > 0) {
      logInfo(`Sample activity: ${JSON.stringify(activities[0], null, 2)}`);
    }
    return true;
  } else {
    logError(`Failed to get activities: ${JSON.stringify(result.error, null, 2)}`);
    return false;
  }
}

/**
 * Test 12: Get My Profile
 */
async function testGetMyProfile() {
  logTest('Test 12: Get My Profile');
  const result = await makeRequest('GET', '/doulas/profile', doulaToken);

  if (result.success) {
    logSuccess('Profile retrieved successfully');
    logInfo(`Profile: ${JSON.stringify(result.data.profile, null, 2)}`);
    return true;
  } else {
    logError(`Failed to get profile: ${JSON.stringify(result.error, null, 2)}`);
    return false;
  }
}

/**
 * Test 13: Update My Profile
 */
async function testUpdateMyProfile() {
  logTest('Test 13: Update My Profile');
  const result = await makeRequest(
    'PUT',
    '/doulas/profile',
    doulaToken,
    {
      bio: 'Updated bio from test script',
      phone_number: '555-1234',
    }
  );

  if (result.success) {
    logSuccess('Profile updated successfully');
    logInfo(`Updated profile: ${JSON.stringify(result.data.profile, null, 2)}`);
    return true;
  } else {
    logError(`Failed to update profile: ${JSON.stringify(result.error, null, 2)}`);
    return false;
  }
}

/**
 * Test 14: Delete Document
 */
async function testDeleteDocument() {
  logTest('Test 14: Delete Document');

  if (!documentId) {
    logInfo('Skipping - No document ID available. Run test 4 first.');
    return true;
  }

  const result = await makeRequest('DELETE', `/doulas/documents/${documentId}`, doulaToken);

  if (result.success) {
    logSuccess('Document deleted successfully');
    return true;
  } else {
    logError(`Failed to delete document: ${JSON.stringify(result.error, null, 2)}`);
    return false;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  log('\n🚀 Starting Doula Management Endpoints Test Suite\n', 'cyan');
  log(`Base URL: ${BASE_URL}`, 'yellow');
  log(`API Base: ${API_BASE}\n`, 'yellow');

  const results: { test: string; passed: boolean }[] = [];

  // Check server connection first
  const serverConnected = await testServerConnection();
  if (!serverConnected) {
    logError('\n❌ Cannot proceed without server connection. Please start the server first.');
    logInfo('Run: npm start');
    process.exit(1);
  }

  // Authentication tests
  results.push({ test: 'Admin Login', passed: await testAdminLogin() });
  results.push({ test: 'Doula Login', passed: await testDoulaLogin() });

  if (!doulaToken) {
    logError('\n❌ Cannot continue without doula authentication. Please check your test credentials.');
    return;
  }

  // Admin endpoints
  results.push({ test: 'Invite Doula', passed: await testInviteDoula() });

  // Document management
  results.push({ test: 'Upload Document', passed: await testUploadDocument() });
  results.push({ test: 'Get My Documents', passed: await testGetMyDocuments() });

  // Client access
  results.push({ test: 'Get My Clients', passed: await testGetMyClients() });
  results.push({ test: 'Get Client Details', passed: await testGetClientDetails() });

  // Hours logging
  results.push({ test: 'Log Hours', passed: await testLogHours() });
  results.push({ test: 'Get My Hours', passed: await testGetMyHours() });

  // Activities
  results.push({ test: 'Add Client Activity', passed: await testAddClientActivity() });
  results.push({ test: 'Get Client Activities', passed: await testGetClientActivities() });

  // Profile management
  results.push({ test: 'Get My Profile', passed: await testGetMyProfile() });
  results.push({ test: 'Update My Profile', passed: await testUpdateMyProfile() });

  // Cleanup
  results.push({ test: 'Delete Document', passed: await testDeleteDocument() });

  // Summary
  log('\n' + '='.repeat(60), 'cyan');
  log('📊 Test Results Summary', 'cyan');
  log('='.repeat(60), 'cyan');

  const passed = results.filter(r => r.passed).length;
  const total = results.length;

  results.forEach(({ test, passed }) => {
    if (passed) {
      logSuccess(`${test}`);
    } else {
      logError(`${test}`);
    }
  });

  log('\n' + '='.repeat(60), 'cyan');
  log(`Total: ${passed}/${total} tests passed`, passed === total ? 'green' : 'yellow');
  log('='.repeat(60) + '\n', 'cyan');

  if (passed === total) {
    logSuccess('🎉 All tests passed!');
  } else {
    logError(`⚠️  ${total - passed} test(s) failed. Please review the errors above.`);
  }
}

// Run tests
runTests().catch((error) => {
  logError(`\nFatal error: ${error.message}`);
  console.error(error);
  process.exit(1);
});
