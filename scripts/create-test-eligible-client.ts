/**
 * Create test data: a client with signed contract and completed first payment
 * This allows testing the portal invite feature end-to-end
 */

import dotenv from 'dotenv';
import supabase from '../src/supabase';

dotenv.config();

async function createTestEligibleClient() {
  console.log('🧪 Creating test eligible client...\n');

  try {
    // Step 1: Find or create a test client
    console.log('1️⃣  Finding or creating test client...');
    const testEmail = `test-portal-${Date.now()}@example.com`;

    const { data: existingClient } = await supabase
      .from('client_info')
      .select('id, email')
      .eq('email', testEmail)
      .single();

    let clientId: string;

    if (existingClient) {
      clientId = existingClient.id;
      console.log(`   ✅ Using existing client: ${clientId}`);
    } else {
      // Create a minimal test client
      const { data: newClient, error: clientError } = await supabase
        .from('client_info')
        .insert({
          email: testEmail,
          firstname: 'Test',
          lastname: 'Portal Client',
          status: 'active',
          portal_status: 'not_invited'
        })
        .select('id')
        .single();

      if (clientError || !newClient) {
        throw new Error(`Failed to create client: ${clientError?.message || 'Unknown error'}`);
      }

      clientId = newClient.id;
      console.log(`   ✅ Created test client: ${clientId} (${testEmail})`);
    }

    // Step 2: Create a signed contract for this client
    console.log('\n2️⃣  Creating signed contract...');
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .insert({
        client_id: clientId,
        status: 'signed',
        fee: '$3000',
        deposit: '$500',
        template_name: 'Test Contract',
        updated_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (contractError || !contract) {
      throw new Error(`Failed to create contract: ${contractError?.message || 'Unknown error'}`);
    }

    console.log(`   ✅ Created signed contract: ${contract.id}`);

    // Step 3: Create a completed deposit payment
    console.log('\n3️⃣  Creating completed deposit payment...');
    const { data: payment, error: paymentError } = await supabase
      .from('contract_payments')
      .insert({
        contract_id: contract.id,
        payment_type: 'deposit',
        amount: 500.00,
        status: 'succeeded',
        completed_at: new Date().toISOString(),
        stripe_payment_intent_id: `test_pi_${Date.now()}`
      })
      .select('id')
      .single();

    if (paymentError || !payment) {
      throw new Error(`Failed to create payment: ${paymentError?.message || 'Unknown error'}`);
    }

    console.log(`   ✅ Created completed payment: ${payment.id}`);

    // Step 4: Verify eligibility
    console.log('\n4️⃣  Verifying eligibility...');
    const { data: contractCheck } = await supabase
      .from('contracts')
      .select('id, status')
      .eq('client_id', clientId)
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
      console.log('   ✅ Client is eligible for portal invite!');
    } else {
      console.log('   ⚠️  Eligibility check failed');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Test client created successfully!');
    console.log('\n📋 Test Client Details:');
    console.log(`   Client ID: ${clientId}`);
    console.log(`   Email: ${testEmail}`);
    console.log(`   Contract ID: ${contract.id}`);
    console.log(`   Payment ID: ${payment.id}`);
    console.log('\n💡 To test portal invite, run:');
    console.log(`   npx tsx scripts/test-portal-invite-full.ts`);
    console.log(`   Or use client ID: ${clientId}`);

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

createTestEligibleClient();
