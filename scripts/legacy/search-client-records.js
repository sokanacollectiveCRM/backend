const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function searchClientRecords() {
  try {
    console.log('🔍 Searching all client_info records for preferred_contact_method...');

    // First, let's check if the column exists at all
    console.log('\n1. Checking if preferred_contact_method column exists...');

    const { data: columnCheck, error: columnError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'client_info')
      .eq('column_name', 'preferred_contact_method');

    if (columnError) {
      console.error('❌ Error checking column:', columnError);
    } else if (columnCheck && columnCheck.length > 0) {
      console.log('✅ preferred_contact_method column EXISTS');
    } else {
      console.log('❌ preferred_contact_method column does NOT exist');
    }

    // Get all client records to see what's actually stored
    console.log('\n2. Fetching all client records...');

    const { data: allClients, error: fetchError } = await supabase
      .from('client_info')
      .select('id, firstname, lastname, email, status, updated_at')
      .order('updated_at', { ascending: false })
      .limit(10);

    if (fetchError) {
      console.error('❌ Error fetching clients:', fetchError);
      return;
    }

    console.log(`📊 Found ${allClients.length} recent client records:`);
    allClients.forEach((client, index) => {
      console.log(`  ${index + 1}. ${client.firstname} ${client.lastname} (${client.email}) - Status: ${client.status} - Updated: ${client.updated_at}`);
    });

    // Try to get a specific client record with all fields
    console.log('\n3. Getting detailed record for the client that was being updated...');

    const { data: detailedClient, error: detailError } = await supabase
      .from('client_info')
      .select('*')
      .eq('id', '0f697eae-b36f-4083-a41d-59f2d6671341') // The client ID from your error
      .single();

    if (detailError) {
      console.error('❌ Error fetching detailed client:', detailError);
    } else if (detailedClient) {
      console.log('✅ Found the specific client record:');
      console.log(`   Name: ${detailedClient.firstname} ${detailedClient.lastname}`);
      console.log(`   Email: ${detailedClient.email}`);
      console.log(`   Status: ${detailedClient.status}`);
      console.log(`   Updated: ${detailedClient.updated_at}`);

      // Check for preferred_contact_method specifically
      if ('preferred_contact_method' in detailedClient) {
        console.log(`   preferred_contact_method: "${detailedClient.preferred_contact_method}"`);
      } else {
        console.log('   ❌ preferred_contact_method field not found in this record');
      }

      // Show all fields that contain "contact" or "preferred"
      console.log('\n   Fields containing "contact" or "preferred":');
      Object.keys(detailedClient).forEach(key => {
        if (key.toLowerCase().includes('contact') || key.toLowerCase().includes('preferred')) {
          console.log(`     ${key}: "${detailedClient[key]}"`);
        }
      });

    } else {
      console.log('❌ Could not find the specific client record');
    }

    // Check recent updates to see what's being saved
    console.log('\n4. Checking recent updates...');

    const { data: recentUpdates, error: updateError } = await supabase
      .from('client_info')
      .select('id, firstname, lastname, updated_at, status')
      .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
      .order('updated_at', { ascending: false });

    if (updateError) {
      console.error('❌ Error fetching recent updates:', updateError);
    } else {
      console.log(`📅 Recent updates (last 24 hours): ${recentUpdates.length} records`);
      recentUpdates.forEach((update, index) => {
        console.log(`  ${index + 1}. ${update.firstname} ${update.lastname} - Updated: ${update.updated_at} - Status: ${update.status}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

searchClientRecords();
