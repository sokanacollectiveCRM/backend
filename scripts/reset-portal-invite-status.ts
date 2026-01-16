import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Get email from command line argument
const email = process.argv[2];

if (!email) {
  console.error('❌ Usage: npx tsx scripts/reset-portal-invite-status.ts <email>');
  console.error('   Example: npx tsx scripts/reset-portal-invite-status.ts jerry@techluminateacademy.com');
  process.exit(1);
}

async function resetPortalInviteStatus() {
  console.log('🔄 Resetting portal invite status...\n');
  console.log(`Email: ${email}\n`);

  try {
    // Find client by email
    const { data: client, error: clientError } = await supabase
      .from('client_info')
      .select('id, email, firstname, lastname, portal_status, auth_user_id')
      .eq('email', email)
      .single();

    if (clientError || !client) {
      console.error('❌ Client not found with email:', email);
      process.exit(1);
    }

    console.log(`Found client: ${client.firstname} ${client.lastname}`);
    console.log(`Current portal_status: ${client.portal_status}`);
    console.log(`Current auth_user_id: ${client.auth_user_id || 'null'}\n`);

    // Reset portal invite fields
    const { data: updatedClient, error: updateError } = await supabase
      .from('client_info')
      .update({
        portal_status: 'not_invited',
        invited_at: null,
        last_invite_sent_at: null,
        invite_sent_count: 0,
        invited_by: null,
        auth_user_id: null, // Clear auth_user_id so a new one can be created
      })
      .eq('id', client.id)
      .select('id, email, portal_status, auth_user_id')
      .single();

    if (updateError) {
      console.error('❌ Error resetting portal status:', updateError);
      process.exit(1);
    }

    console.log('✅ Portal invite status reset successfully!\n');
    console.log('📊 Updated Client:');
    console.log(`   ID: ${updatedClient.id}`);
    console.log(`   Email: ${updatedClient.email}`);
    console.log(`   Portal Status: ${updatedClient.portal_status}`);
    console.log(`   Auth User ID: ${updatedClient.auth_user_id || 'null'}\n`);
    console.log('💡 You can now send another portal invite to this client.');

  } catch (error: any) {
    console.error('\n❌ Error resetting portal invite status:');
    console.error(error.message);
    process.exit(1);
  }
}

resetPortalInviteStatus();

