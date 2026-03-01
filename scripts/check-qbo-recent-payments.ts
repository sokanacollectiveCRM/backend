#!/usr/bin/env npx tsx
/**
 * Query QuickBooks for recent payments to verify Stripe→QBO sync.
 * Usage: npx tsx scripts/check-qbo-recent-payments.ts
 */
import 'dotenv/config';
import { qboRequest } from '../src/utils/qboClient';
import { isConnected } from '../src/services/auth/quickbooksAuthService';

async function main() {
  console.log('\n--- QuickBooks recent payments check ---\n');

  const connected = await isConnected();
  if (!connected) {
    console.log('❌ QuickBooks is not connected. Connect at /quickbooks/auth first.');
    process.exit(1);
  }
  console.log('✅ QuickBooks connected\n');

  const query = encodeURIComponent(
    "SELECT * FROM Payment ORDER BY MetaData.CreateTime DESC MAXRESULTS 20"
  );
  const response = (await qboRequest(`/query?query=${query}&minorversion=65`)) as {
    QueryResponse: { Payment: Array<{ Id: string; TotalAmt: number; TxnDate: string; PrivateNote?: string; CustomerRef?: { value: string } }> };
  };

  const payments = (response && response.QueryResponse && response.QueryResponse.Payment) ? response.QueryResponse.Payment : [];
  console.log(`Found ${payments.length} recent payment(s) in QuickBooks:\n`);

  if (payments.length === 0) {
    console.log('No payments in QuickBooks yet.');
    return;
  }

  for (const p of payments) {
    const note = p.PrivateNote || '';
    const stripeMatch = note.match(/Stripe Payment Intent: (pi_\w+)/);
    const stripeId = stripeMatch ? stripeMatch[1] : '-';
    const custId = (p.CustomerRef && p.CustomerRef.value) || '-';
    console.log(`  ID: ${p.Id} | $${p.TotalAmt} | ${p.TxnDate} | Customer: ${custId}`);
    console.log(`    Stripe: ${stripeId}`);
    if (note) console.log(`    Note: ${note.slice(0, 80)}${note.length > 80 ? '...' : ''}`);
    console.log('');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
