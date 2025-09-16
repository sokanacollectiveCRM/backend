const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function testRedirectUrls() {
  console.log('🔗 Testing SignNow Redirect URLs...\n');

  // Get the latest contract with SignNow document ID
  const { data: contracts, error } = await supabase
    .from('contracts')
    .select('id, signnow_document_id, fee, deposit')
    .not('signnow_document_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error || !contracts || contracts.length === 0) {
    console.error('❌ No contracts with SignNow document IDs found');
    return;
  }

  const contract = contracts[0];
  console.log('📄 Latest Contract:');
  console.log(`   Contract ID: ${contract.id}`);
  console.log(`   SignNow Document ID: ${contract.signnow_document_id}`);
  console.log(`   Fee: ${contract.fee}`);
  console.log(`   Deposit: ${contract.deposit}`);

  // Generate redirect URLs
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
  const paymentUrl = `${frontendUrl}/payment?contract_id=${contract.id}`;
  const declineUrl = `${frontendUrl}/contract-declined`;

  console.log('\n🔗 Redirect URLs:');
  console.log(`   Payment URL (after signing): ${paymentUrl}`);
  console.log(`   Decline URL (if declined): ${declineUrl}`);

  console.log('\n📋 SignNow Invitation Payload:');
  const invitePayload = {
    to: [{
      email: "client@example.com",
      role: "Signer 1",
      order: 1
    }],
    from: "jerry@techluminateacademy.com",
    redirect_url: paymentUrl,
    redirect_decline: declineUrl
  };

  console.log(JSON.stringify(invitePayload, null, 2));

  console.log('\n✅ Redirect URLs are ready for SignNow invitations!');
  console.log('   When client signs the contract, they will be redirected to the payment page.');
  console.log('   If they decline, they will be redirected to the decline page.');
}

testRedirectUrls().catch(console.error);
