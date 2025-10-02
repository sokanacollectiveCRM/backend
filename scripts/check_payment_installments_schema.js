const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function checkPaymentInstallmentsSchema() {
  try {
    console.log('🔍 Checking payment_installments table structure...');
    
    // Get table structure
    const { data: columns, error: columnsError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable, column_default')
      .eq('table_name', 'payment_installments')
      .eq('table_schema', 'public');

    if (columnsError) {
      console.error('❌ Error fetching table structure:', columnsError);
      return;
    }

    console.log('📋 payment_installments table columns:');
    console.log('=====================================');
    columns.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    // Check if payment_type column exists
    const hasPaymentType = columns.some(col => col.column_name === 'payment_type');
    console.log(`\n🎯 payment_type column exists: ${hasPaymentType ? '✅ YES' : '❌ NO'}`);

    if (!hasPaymentType) {
      console.log('\n💡 To add the payment_type column, run this SQL:');
      console.log('ALTER TABLE payment_installments ADD COLUMN payment_type VARCHAR(50);');
    }

    // Show sample data if any exists
    const { data: sampleData, error: sampleError } = await supabase
      .from('payment_installments')
      .select('*')
      .limit(3);

    if (!sampleError && sampleData && sampleData.length > 0) {
      console.log('\n📊 Sample data:');
      console.log(JSON.stringify(sampleData, null, 2));
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkPaymentInstallmentsSchema();
