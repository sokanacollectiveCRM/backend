/**
 * Inspect payment data to understand why no eligible clients are found
 */

import dotenv from 'dotenv';
import supabase from '../src/supabase';

dotenv.config();

async function inspectPayments() {
  console.log('🔍 Inspecting payment data...\n');

  try {
    // Get all signed contracts
    const { data: contracts, error: contractsError } = await supabase
      .from('contracts')
      .select('id, client_id, status')
      .eq('status', 'signed')
      .limit(5);

    if (contractsError) {
      throw new Error(`Failed to fetch contracts: ${contractsError.message}`);
    }

    if (!contracts || contracts.length === 0) {
      console.log('❌ No signed contracts found');
      return;
    }

    console.log(`📋 Found ${contracts.length} signed contract(s) (showing first 5)\n`);

    for (const contract of contracts) {
      console.log(`\nContract ID: ${contract.id}`);
      console.log(`Client ID: ${contract.client_id}`);

      // Get all payments for this contract
      const { data: payments, error: paymentsError } = await supabase
        .from('contract_payments')
        .select('*')
        .eq('contract_id', contract.id)
        .order('created_at', { ascending: true });

      if (paymentsError) {
        console.log(`   ⚠️  Error fetching payments: ${paymentsError.message}`);
        continue;
      }

      if (!payments || payments.length === 0) {
        console.log(`   ❌ No payments found for this contract`);
        continue;
      }

      console.log(`   📊 Found ${payments.length} payment(s):`);
      payments.forEach((payment, index) => {
        console.log(`      ${index + 1}. Payment ID: ${payment.id}`);
        console.log(`         Type: ${payment.payment_type || 'NULL'}`);
        console.log(`         Status: ${payment.status || 'NULL'}`);
        console.log(`         Amount: ${payment.amount || 'NULL'}`);
        console.log(`         Completed: ${payment.completed_at || 'NULL'}`);
        console.log(`         Created: ${payment.created_at || 'NULL'}`);
      });

      // Check for deposit payments specifically
      const depositPayments = payments.filter(p => p.payment_type === 'deposit');
      console.log(`   💰 Deposit payments: ${depositPayments.length}`);

      const succeededDeposits = depositPayments.filter(p => p.status === 'succeeded');
      console.log(`   ✅ Succeeded deposits: ${succeededDeposits.length}`);

      if (succeededDeposits.length > 0) {
        console.log(`   🎉 This contract HAS eligible payments!`);
      }
    }

    // Also check overall payment statistics
    console.log('\n\n📊 Overall Payment Statistics:');
    const { data: allPayments, error: allPaymentsError } = await supabase
      .from('contract_payments')
      .select('payment_type, status');

    if (!allPaymentsError && allPayments) {
      const stats: Record<string, Record<string, number>> = {};
      allPayments.forEach(p => {
        const type = p.payment_type || 'NULL';
        const status = p.status || 'NULL';
        if (!stats[type]) stats[type] = {};
        stats[type][status] = (stats[type][status] || 0) + 1;
      });

      console.log('\nPayment Type → Status counts:');
      Object.entries(stats).forEach(([type, statuses]) => {
        console.log(`  ${type}:`);
        Object.entries(statuses).forEach(([status, count]) => {
          console.log(`    ${status}: ${count}`);
        });
      });
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

inspectPayments();
