const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function getClientInfoSchema() {
  try {
    console.log('🔍 Checking client_info table schema...');

    // Query to get all columns from client_info table
    const { data, error } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable, column_default')
      .eq('table_name', 'client_info')
      .eq('table_schema', 'public')
      .order('ordinal_position');

    if (error) {
      console.error('❌ Error fetching schema:', error);
      return;
    }

    console.log('\n📋 Current client_info table columns:');
    console.log('=====================================');

    if (data && data.length > 0) {
      data.forEach((column, index) => {
        console.log(`${index + 1}. ${column.column_name} (${column.data_type}) - ${column.is_nullable === 'YES' ? 'nullable' : 'not null'}`);
      });

      console.log(`\n✅ Total columns: ${data.length}`);

      // Check for specific fields we're trying to use
      const columnNames = data.map(col => col.column_name);
      const missingFields = [
        'preferred_contact_method',
        'preferred_name',
        'home_type',
        'services_interested',
        'health_notes'
      ];

      console.log('\n🔍 Checking for missing fields:');
      missingFields.forEach(field => {
        if (columnNames.includes(field)) {
          console.log(`  ✅ ${field} - EXISTS`);
        } else {
          console.log(`  ❌ ${field} - MISSING`);
        }
      });

    } else {
      console.log('❌ No columns found or table does not exist');
    }

    // Also try to get a sample record to see the structure
    console.log('\n📄 Sample record structure:');
    console.log('============================');

    const { data: sampleData, error: sampleError } = await supabase
      .from('client_info')
      .select('*')
      .limit(1);

    if (sampleError) {
      console.error('❌ Error fetching sample:', sampleError);
    } else if (sampleData && sampleData.length > 0) {
      const sampleRecord = sampleData[0];
      console.log('Sample record fields:');
      Object.keys(sampleRecord).forEach((key, index) => {
        const value = sampleRecord[key];
        const type = typeof value;
        const preview = value ? (type === 'string' ? `"${value.substring(0, 50)}${value.length > 50 ? '...' : ''}"` : value) : 'null';
        console.log(`  ${index + 1}. ${key}: ${preview} (${type})`);
      });
    } else {
      console.log('No records found in client_info table');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

getClientInfoSchema();
