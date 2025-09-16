const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Test Stripe connection
async function testStripeConnection() {
  console.log('🔑 Testing Stripe API Key...\n');

  const stripeKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeKey) {
    console.error('❌ STRIPE_SECRET_KEY not found in environment variables');
    return;
  }

  console.log(`✅ Stripe Secret Key found: ${stripeKey.substring(0, 20)}...`);

  try {
    // Test Stripe API call
    const response = await fetch('https://api.stripe.com/v1/charges?limit=1', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (response.ok) {
      console.log('✅ Stripe API connection successful!');
      console.log(`   Status: ${response.status}`);
    } else {
      const error = await response.text();
      console.error('❌ Stripe API connection failed:');
      console.error(`   Status: ${response.status}`);
      console.error(`   Error: ${error}`);
    }

  } catch (error) {
    console.error('❌ Error testing Stripe connection:', error.message);
  }
}

// Test payment endpoints
async function testPaymentEndpoints() {
  console.log('\n🔗 Testing Payment Endpoints...\n');

  const contractId = 'f2eed073-72f8-469a-b74c-a97256908521'; // Latest contract

  try {
    // Test payment summary endpoint
    const response = await fetch(`http://localhost:5050/api/stripe/contract/${contractId}/payment-summary`);

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Payment Summary Endpoint Working:');
      console.log(`   Contract ID: ${data.data?.contract_id}`);
      console.log(`   Total Amount: $${data.data?.total_amount}`);
      console.log(`   Deposit: $${data.data?.deposit_amount}`);
      console.log(`   Next Payment: $${data.data?.next_payment_amount}`);
    } else {
      console.error('❌ Payment Summary Endpoint Failed:');
      console.error(`   Status: ${response.status}`);
      const error = await response.text();
      console.error(`   Error: ${error}`);
    }

  } catch (error) {
    console.error('❌ Error testing payment endpoints:', error.message);
  }
}

async function main() {
  await testStripeConnection();
  await testPaymentEndpoints();
}

main().catch(console.error);
