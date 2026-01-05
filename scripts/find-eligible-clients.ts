/**
 * Helper script to find clients eligible for portal invite
 * Eligibility: contract signed AND first deposit payment succeeded
 */

import dotenv from 'dotenv';
import supabase from '../src/supabase';

dotenv.config();

async function findEligibleClients() {
  console.log('🔍 Finding clients eligible for portal invite...\n');

  try {
    // Find clients with signed contracts
    const { data: contracts, error: contractsError } = await supabase
      .from('contracts')
      .select('id, client_id, status, updated_at')
      .eq('status', 'signed')
      .order('updated_at', { ascending: false });

    if (contractsError) {
      throw new Error(`Failed to fetch contracts: ${contractsError.message}`);
    }

    if (!contracts || contracts.length === 0) {
      console.log('❌ No signed contracts found');
      return;
    }

    console.log(`📋 Found ${contracts.length} signed contract(s)\n`);

    const eligibleClients: Array<{
      clientId: string;
      contractId: string;
      contractSignedAt: string;
      paymentCompletedAt: string;
      email?: string;
      name?: string;
    }> = [];

    // Check each contract for completed first payment
    for (const contract of contracts) {
      const { data: payment, error: paymentError } = await supabase
        .from('contract_payments')
        .select('id, status, completed_at, payment_type')
        .eq('contract_id', contract.id)
        .eq('payment_type', 'deposit')
        .eq('status', 'succeeded')
        .order('completed_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (paymentError) {
        console.warn(`⚠️  Error checking payment for contract ${contract.id}: ${paymentError.message}`);
        continue;
      }

      if (payment && payment.completed_at) {
        // Get client info
        const { data: client, error: clientError } = await supabase
          .from('client_info')
          .select('id, email, firstname, lastname')
          .eq('id', contract.client_id)
          .single();

        if (clientError || !client) {
          console.warn(`⚠️  Could not fetch client info for ${contract.client_id}`);
          continue;
        }

        eligibleClients.push({
          clientId: contract.client_id,
          contractId: contract.id,
          contractSignedAt: contract.updated_at || '',
          paymentCompletedAt: payment.completed_at,
          email: client.email || undefined,
          name: `${client.firstname || ''} ${client.lastname || ''}`.trim() || undefined
        });
      }
    }

    if (eligibleClients.length === 0) {
      console.log('❌ No eligible clients found (need signed contract + completed first payment)');
      return;
    }

    console.log(`✅ Found ${eligibleClients.length} eligible client(s):\n`);
    eligibleClients.forEach((client, index) => {
      console.log(`${index + 1}. Client ID: ${client.clientId}`);
      console.log(`   Name: ${client.name || 'N/A'}`);
      console.log(`   Email: ${client.email || 'N/A'}`);
      console.log(`   Contract ID: ${client.contractId}`);
      console.log(`   Contract Signed: ${client.contractSignedAt}`);
      console.log(`   Payment Completed: ${client.paymentCompletedAt}`);
      console.log('');
    });

    console.log('\n💡 To test portal invite, run:');
    console.log(`   npm run ts-node scripts/test-portal-invite.ts ${eligibleClients[0].clientId} invite`);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

findEligibleClients();
