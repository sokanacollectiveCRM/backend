import supabase from '../supabase';

async function checkTables() {
  console.log('Checking database tables...');

  // Check payment_methods table
  const { data: paymentMethodsData, error: paymentMethodsError } = await supabase
    .from('payment_methods')
    .select('*')
    .limit(1);

  console.log('\nPayment Methods Table:');
  if (paymentMethodsError) {
    console.error('Error:', paymentMethodsError.message);
  } else {
    console.log('✅ Table exists');
  }

  // Check charges table
  const { data: chargesData, error: chargesError } = await supabase
    .from('charges')
    .select('*')
    .limit(1);

  console.log('\nCharges Table:');
  if (chargesError) {
    console.error('Error:', chargesError.message);
  } else {
    console.log('✅ Table exists');
  }
}

// Run the check
checkTables().catch(console.error); 