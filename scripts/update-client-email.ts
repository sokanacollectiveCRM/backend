/**
 * Update client email to a valid email address
 * 
 * Usage: npx tsx scripts/update-client-email.ts <clientId> <newEmail>
 * Example: npx tsx scripts/update-client-email.ts 52a2c584-1725-4aa1-90d9-e6509f059559 jerry@jerrybony.me
 */

import dotenv from 'dotenv';
import supabase from '../src/supabase';

dotenv.config();

async function updateClientEmail() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: npx tsx scripts/update-client-email.ts <clientId> <newEmail>');
    console.error('Example: npx tsx scripts/update-client-email.ts 52a2c584-1725-4aa1-90d9-e6509f059559 jerry@jerrybony.me');
    process.exit(1);
  }

  const [clientId, newEmail] = args;

  if (!newEmail || !newEmail.includes('@')) {
    console.error('❌ Invalid email address');
    process.exit(1);
  }

  console.log(`📧 Updating client email...\n`);
  console.log(`   Client ID: ${clientId}`);
  console.log(`   New Email: ${newEmail}\n`);

  try {
    // Get current client info
    const { data: currentClient, error: fetchError } = await supabase
      .from('client_info')
      .select('id, email, firstname, lastname')
      .eq('id', clientId)
      .single();

    if (fetchError || !currentClient) {
      throw new Error(`Client not found: ${fetchError?.message || 'Unknown error'}`);
    }

    console.log('✅ Current client found:');
    console.log(`   Name: ${currentClient.firstname || ''} ${currentClient.lastname || ''}`.trim() || 'N/A');
    console.log(`   Current Email: ${currentClient.email || 'N/A'}\n`);

    // Update email
    const { data: updatedClient, error: updateError } = await supabase
      .from('client_info')
      .update({ email: newEmail })
      .eq('id', clientId)
      .select('id, email, firstname, lastname')
      .single();

    if (updateError || !updatedClient) {
      throw new Error(`Failed to update email: ${updateError?.message || 'Unknown error'}`);
    }

    console.log('✅ Email updated successfully!');
    console.log(`   New Email: ${updatedClient.email}\n`);

    console.log('💡 Client is ready for portal invite test');
    console.log(`   Client ID: ${updatedClient.id}`);

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

updateClientEmail();

