const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function getPaymentSummaryDirect(contractId) {
  console.log('💰 Getting payment summary for contract:', contractId);

  try {
    // Get contract details
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('id, fee, deposit, status')
      .eq('id', contractId)
      .single();

    if (contractError) {
      throw new Error(`Contract not found: ${contractError.message}`);
    }

    // Get payment schedule
    const { data: schedule, error: scheduleError } = await supabase
      .from('payment_schedules')
      .select('total_amount, deposit_amount, remaining_balance')
      .eq('contract_id', contractId)
      .single();

    if (scheduleError) {
      throw new Error(`Payment schedule not found: ${scheduleError.message}`);
    }

    // Get installments
    const { data: installments, error: installmentsError } = await supabase
      .from('payment_installments')
      .select('amount, due_date, status')
      .eq('contract_id', contractId)
      .order('due_date', { ascending: true });

    if (installmentsError) {
      throw new Error(`Installments not found: ${installmentsError.message}`);
    }

    // Calculate summary
    const totalAmount = parseFloat(schedule.total_amount);
    const depositAmount = parseFloat(schedule.deposit_amount);
    const remainingBalance = parseFloat(schedule.remaining_balance);

    // Find next payment
    const nextPayment = installments.find(inst => inst.status === 'pending');

    const summary = {
      contract_id: contractId,
      total_amount: totalAmount,
      deposit_amount: depositAmount,
      remaining_balance: remainingBalance,
      next_payment_amount: nextPayment ? parseFloat(nextPayment.amount) : 0,
      next_payment_due_date: nextPayment ? nextPayment.due_date : null,
      installments: installments.map(inst => ({
        amount: parseFloat(inst.amount),
        due_date: inst.due_date,
        status: inst.status
      }))
    };

    console.log('✅ Payment summary generated:', summary);
    return summary;

  } catch (error) {
    console.error('❌ Error getting payment summary:', error);
    throw error;
  }
}

async function main() {
  const contractId = 'f2eed073-72f8-469a-b74c-a97256908521';
  await getPaymentSummaryDirect(contractId);
}

main().catch(console.error);
