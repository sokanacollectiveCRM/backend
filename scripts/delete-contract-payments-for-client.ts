#!/usr/bin/env npx tsx
/**
 * Delete contract payment details for a client (by email) so you can test again.
 * Usage: npx tsx scripts/delete-contract-payments-for-client.ts info@techluminateacademy.com
 */
import 'dotenv/config';
import { getPool } from '../src/db/cloudSqlPool';

const email = process.argv[2] || 'info@techluminateacademy.com';

async function run() {
  const pool = getPool();

  const { rows: clients } = await pool.query<{ id: string }>(
    'SELECT id FROM phi_clients WHERE LOWER(email) = LOWER($1)',
    [email]
  );
  if (clients.length === 0) {
    console.error(`❌ No client found with email: ${email}`);
    process.exit(1);
  }
  const clientId = clients[0].id;
  console.log(`Found client: ${clientId}`);

  const { rows: contracts } = await pool.query<{ id: string }>(
    'SELECT id FROM phi_contracts WHERE client_id = $1',
    [clientId]
  );
  const contractIds = contracts.map((c) => c.id);
  if (contractIds.length === 0) {
    console.log('No contracts found for this client.');
    process.exit(0);
  }
  console.log(`Found ${contractIds.length} contract(s): ${contractIds.join(', ')}`);

  // Delete payment_installments (via schedule_id)
  const { rowCount: instCount } = await pool.query(
    `DELETE FROM payment_installments
     WHERE schedule_id IN (SELECT id FROM payment_schedules WHERE contract_id = ANY($1::uuid[]))`,
    [contractIds]
  );
  console.log(`Deleted ${instCount ?? 0} payment_installments`);

  // Delete payment_schedules
  const { rowCount: schedCount } = await pool.query(
    'DELETE FROM payment_schedules WHERE contract_id = ANY($1::uuid[])',
    [contractIds]
  );
  console.log(`Deleted ${schedCount ?? 0} payment_schedules`);

  // Delete payment records for this client (contract payments recorded in payments table)
  try {
    const { rowCount: payCount } = await pool.query(
      'DELETE FROM payments WHERE client_id = $1',
      [clientId]
    );
    console.log(`Deleted ${payCount ?? 0} payment records for client`);
  } catch (e) {
    console.warn('Could not delete from payments (table/column may differ):', (e as Error).message);
  }

  console.log('✅ Done. You can test the payment flow again.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
