/**
 * Test script for Portal Invite endpoints
 *
 * Usage:
 *   npm run ts-node scripts/test-portal-invite.ts <clientId> <action>
 *
 * Actions:
 *   - invite: Invite client to portal
 *   - resend: Resend portal invite
 *   - disable: Disable portal access
 *
 * Example:
 *   npm run ts-node scripts/test-portal-invite.ts abc123 invite
 */

import dotenv from 'dotenv';

dotenv.config();

const API_BASE_URL = process.env.API_URL || 'http://localhost:5050';
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || '';

interface LoginResponse {
  accessToken?: string;
  user?: {
    id: string;
    email: string;
    role: string;
  };
  error?: string;
}

async function login(): Promise<string> {
  console.log('🔐 Logging in as admin...');

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

  if (!data.accessToken) {
    throw new Error('No access token received');
  }

  console.log('✅ Login successful');
  return data.accessToken;
}

async function inviteClient(clientId: string, token: string): Promise<void> {
  console.log(`📧 Inviting client ${clientId} to portal...`);

  const response = await fetch(`${API_BASE_URL}/api/admin/clients/${clientId}/portal/invite`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('❌ Invite failed:', data);
    throw new Error(data.error?.message || 'Invite failed');
  }

  console.log('✅ Invite successful:', data);
}

async function resendInvite(clientId: string, token: string): Promise<void> {
  console.log(`📧 Resending portal invite for client ${clientId}...`);

  const response = await fetch(`${API_BASE_URL}/api/admin/clients/${clientId}/portal/resend`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('❌ Resend failed:', data);
    throw new Error(data.error?.message || 'Resend failed');
  }

  console.log('✅ Resend successful:', data);
}

async function disableAccess(clientId: string, token: string): Promise<void> {
  console.log(`🚫 Disabling portal access for client ${clientId}...`);

  const response = await fetch(`${API_BASE_URL}/api/admin/clients/${clientId}/portal/disable`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('❌ Disable failed:', data);
    throw new Error(data.error?.message || 'Disable failed');
  }

  console.log('✅ Disable successful:', data);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: npm run ts-node scripts/test-portal-invite.ts <clientId> <action>');
    console.error('Actions: invite, resend, disable');
    process.exit(1);
  }

  const [clientId, action] = args;

  if (!['invite', 'resend', 'disable'].includes(action)) {
    console.error('Invalid action. Must be: invite, resend, or disable');
    process.exit(1);
  }

  try {
    const token = await login();

    switch (action) {
      case 'invite':
        await inviteClient(clientId, token);
        break;
      case 'resend':
        await resendInvite(clientId, token);
        break;
      case 'disable':
        await disableAccess(clientId, token);
        break;
    }

    console.log('✅ Test completed successfully');
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

main();
