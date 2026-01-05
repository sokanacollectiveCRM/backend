/**
 * Create a test client with all requirements for portal invite:
 * 1. Client record in client_info
 * 2. Signed contract
 * 3. Completed first payment (deposit, status = 'succeeded')
 *
 * Usage: npx tsx scripts/create-eligible-client-for-invite.ts
 */
import dotenv from 'dotenv';

import supabase from '../src/supabase';

dotenv.config();

async function createEligibleClient() {
  console.log('🚀 Creating eligible client for portal invite...\n');

  try {
    // Step 1: Create or find a test client
    const timestamp = Date.now();
    const testEmail = `portal-test-${timestamp}@example.com`;

    console.log('1️⃣  Creating client record...');
    // Use minimal required fields only
    const { data: client, error: clientError } = await supabase
      .from('client_info')
      .insert({
        email: testEmail,
        firstname: 'Test',
        lastname: 'Portal Client',
        status: 'active',
        portal_status: 'not_invited',
      })
      .select('id, email')
      .single();

    if (clientError || !client) {
      throw new Error(
        `Failed to create client: ${clientError?.message || 'Unknown error'}`
      );
    }

    console.log(`   ✅ Client created: ${client.id}`);
    console.log(`   📧 Email: ${client.email}\n`);

    // Step 2: Create a signed contract
    console.log('2️⃣  Creating signed contract...');
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .insert({
        client_id: client.id,
        status: 'signed',
        fee: '$3000',
        deposit: '$500',
        template_name: 'Test Portal Contract',
        updated_at: new Date().toISOString(),
      })
      .select('id, status')
      .single();

    if (contractError || !contract) {
      throw new Error(
        `Failed to create contract: ${contractError?.message || 'Unknown error'}`
      );
    }

    console.log(`   ✅ Contract created: ${contract.id}`);
    console.log(`   📝 Status: ${contract.status}\n`);

    // Step 3: Create a completed deposit payment
    console.log('3️⃣  Creating completed deposit payment...');
    const { data: payment, error: paymentError } = await supabase
      .from('contract_payments')
      .insert({
        contract_id: contract.id,
        payment_type: 'deposit',
        amount: 500.0,
        status: 'succeeded',
        completed_at: new Date().toISOString(),
        stripe_payment_intent_id: `test_pi_${timestamp}`,
      })
      .select('id, status, payment_type, amount')
      .single();

    if (paymentError || !payment) {
      throw new Error(
        `Failed to create payment: ${paymentError?.message || 'Unknown error'}`
      );
    }

    console.log(`   ✅ Payment created: ${payment.id}`);
    console.log(`   💰 Amount: $${payment.amount}`);
    console.log(`   📊 Status: ${payment.status}`);
    console.log(`   🏷️  Type: ${payment.payment_type}\n`);

    // Step 4: Verify eligibility
    console.log('4️⃣  Verifying eligibility...');
    const { data: contractCheck } = await supabase
      .from('contracts')
      .select('id, status')
      .eq('client_id', client.id)
      .eq('status', 'signed')
      .single();

    const { data: paymentCheck } = await supabase
      .from('contract_payments')
      .select('id, status, payment_type')
      .eq('contract_id', contract.id)
      .eq('payment_type', 'deposit')
      .eq('status', 'succeeded')
      .single();

    if (contractCheck && paymentCheck) {
      console.log('   ✅ Client is eligible for portal invite!\n');
    } else {
      console.log('   ⚠️  Eligibility verification failed\n');
    }

    // Summary
    console.log('='.repeat(60));
    console.log('✅ Eligible client created successfully!\n');
    console.log('📋 Client Details:');
    console.log(`   Client ID: ${client.id}`);
    console.log(`   Email: ${client.email}`);
    console.log(`   Name: Test Portal Client`);
    console.log(`   Contract ID: ${contract.id}`);
    console.log(`   Payment ID: ${payment.id}\n`);

    console.log('💡 To test portal invite, run:');
    console.log(`   npx tsx scripts/test-portal-invite-full.ts`);
    console.log(`   Or use this client ID: ${client.id}\n`);

    console.log('📧 To invite via API:');
    console.log(`   POST /api/admin/clients/${client.id}/portal/invite`);
    console.log(`   (Requires admin authentication)\n`);
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

createEligibleClient();
