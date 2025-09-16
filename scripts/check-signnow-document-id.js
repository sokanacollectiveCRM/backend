const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkSignNowDocumentIds() {
  console.log('🔍 Checking SignNow document IDs in contracts table...\n');

  try {
    // Get all contracts with client info
    const { data: contracts, error } = await supabase
      .from('contracts')
      .select(`
        id,
        signnow_document_id,
        client_id,
        status,
        fee,
        deposit,
        created_at,
        client_info:client_id (
          firstname,
          lastname,
          email
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching contracts:', error);
      return;
    }

    console.log(`📊 Found ${contracts.length} contracts:\n`);

    contracts.forEach((contract, index) => {
      console.log(`📄 Contract ${index + 1}:`);
      console.log(`   Contract ID: ${contract.id}`);
      console.log(`   SignNow Document ID: ${contract.signnow_document_id || '❌ MISSING'}`);
      console.log(`   Client: ${contract.client_info?.firstname || ''} ${contract.client_info?.lastname || ''}`);
      console.log(`   Email: ${contract.client_info?.email || 'N/A'}`);
      console.log(`   Status: ${contract.status}`);
      console.log(`   Fee: ${contract.fee}`);
      console.log(`   Deposit: ${contract.deposit}`);
      console.log(`   Created: ${contract.created_at}`);
      console.log('');
    });

    // Summary
    const withSignNowId = contracts.filter(c => c.signnow_document_id).length;
    const withoutSignNowId = contracts.length - withSignNowId;

    console.log('📈 Summary:');
    console.log(`   Total contracts: ${contracts.length}`);
    console.log(`   With SignNow ID: ${withSignNowId} ✅`);
    console.log(`   Missing SignNow ID: ${withoutSignNowId} ❌`);

    if (withoutSignNowId > 0) {
      console.log('\n⚠️  Some contracts are missing SignNow document IDs!');
      console.log('   This means the fix may not be working or these contracts were created before the fix.');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkSignNowDocumentIds();
