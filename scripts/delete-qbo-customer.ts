#!/usr/bin/env npx tsx
/**
 * Make a QuickBooks customer inactive (QBO does not support permanent deletion).
 * Usage: npx tsx scripts/delete-qbo-customer.ts <qbo_customer_id>
 * Example: npx tsx scripts/delete-qbo-customer.ts 86
 */
import 'dotenv/config';
import { qboRequest } from '../src/utils/qboClient';
import { isConnected } from '../src/services/auth/quickbooksAuthService';

async function main() {
  const qboCustomerId = process.argv[2];
  if (!qboCustomerId) {
    console.error('Usage: npx tsx scripts/delete-qbo-customer.ts <qbo_customer_id>');
    console.error('Example: npx tsx scripts/delete-qbo-customer.ts 86');
    process.exit(1);
  }

  console.log(`\n--- Make QuickBooks customer ${qboCustomerId} inactive ---\n`);

  const connected = await isConnected();
  if (!connected) {
    console.log('❌ QuickBooks is not connected. Connect at /quickbooks/auth first.');
    process.exit(1);
  }
  console.log('✅ QuickBooks connected\n');

  try {
    // 1. Fetch the customer to get SyncToken and current data
    const query = encodeURIComponent(`SELECT * FROM Customer WHERE Id = '${qboCustomerId}'`);
    const queryResponse = (await qboRequest(`/query?query=${query}&minorversion=65`)) as {
      QueryResponse?: { Customer?: Array<{ Id: string; SyncToken: string; DisplayName?: string; Active?: boolean }> };
    };
    const customers = queryResponse?.QueryResponse?.Customer ?? [];
    if (customers.length === 0) {
      console.error(`❌ Customer ${qboCustomerId} not found in QuickBooks.`);
      process.exit(1);
    }

    const customer = customers[0];
    if (customer.Active === false) {
      console.log(`ℹ️ Customer ${qboCustomerId} (${customer.DisplayName ?? 'unknown'}) is already inactive.`);
      return;
    }

    console.log(`Found customer: ${customer.DisplayName ?? customer.Id} (SyncToken: ${customer.SyncToken})\n`);

    // 2. Update customer to Active: false (QBO "delete" = make inactive)
    await qboRequest(`/customer?minorversion=65`, {
      method: 'POST',
      body: JSON.stringify({
        Id: customer.Id,
        SyncToken: customer.SyncToken,
        sparse: true,
        Active: false,
      }),
    });

    console.log(`✅ Customer ${qboCustomerId} (${customer.DisplayName ?? 'unknown'}) has been made inactive.`);
    console.log('\nNote: In QuickBooks, "delete" means make inactive. The customer still exists for historical transactions.');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('❌ Error:', msg);
    process.exit(1);
  }
}

main();
