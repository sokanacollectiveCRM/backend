/**
 * Report: status of every client + whether they have payments (→ active/done).
 * Uses Cloud SQL: phi_clients + payments (or phi_invoices / phi_contracts).
 * Requires CLOUD_SQL_* env (or .env).
 *
 * Usage: npx tsx scripts/client-status-from-payments.ts
 */

import 'dotenv/config';
import { getPool } from '../src/db/cloudSqlPool';

async function main() {
  const pool = getPool();

  // 1) List columns of payments-related tables to see how they link to clients
  const { rows: paymentColumns } = await pool.query<{ table_name: string; column_name: string }>(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('payments', 'phi_invoices', 'phi_contracts', 'phi_clients')
    ORDER BY table_name, ordinal_position
  `);

  console.log('Columns in payments-related tables:\n');
  const byTable = paymentColumns.reduce<Record<string, string[]>>((acc, r) => {
    if (!acc[r.table_name]) acc[r.table_name] = [];
    acc[r.table_name].push(r.column_name);
    return acc;
  }, {});
  for (const [table, cols] of Object.entries(byTable)) {
    console.log(`  ${table}: ${cols.join(', ')}\n`);
  }

  // 2) Find link to client: usually client_id or user_id on payments/invoices/contracts
  const hasClientId = (t: string) => byTable[t]?.some((c) => c === 'client_id' || c === 'client_id');
  const paymentsHasClient = byTable['payments']?.some((c) => c === 'client_id');
  const invoicesHasClient = byTable['phi_invoices']?.some((c) => c === 'client_id');
  const contractsHasClient = byTable['phi_contracts']?.some((c) => c === 'client_id');

  // 3) Query: all clients with current status + has_payment (any succeeded payment)
  let clientStatusQuery = '';
  const clientIdCol = 'id'; // phi_clients.id

  // Prefer phi_invoices: has client_id and status (PAID/PARTIAL). payments has 120 rows but all client_id null.
  if (invoicesHasClient) {
    clientStatusQuery = `
      SELECT
        c.id,
        c.first_name,
        c.last_name,
        c.email,
        c.status AS current_status,
        c.portal_status,
        EXISTS (
          SELECT 1 FROM phi_invoices i
          WHERE i.client_id = c.id
          AND (i.status = 'PAID' OR (i.status = 'PARTIAL' AND i.paid_total_amount > 0))
        ) AS has_payment
      FROM phi_clients c
      ORDER BY c.updated_at DESC NULLS LAST
    `;
  } else if (paymentsHasClient) {
    clientStatusQuery = `
      SELECT
        c.id,
        c.first_name,
        c.last_name,
        c.email,
        c.status AS current_status,
        c.portal_status,
        EXISTS (SELECT 1 FROM payments p WHERE p.client_id = c.id) AS has_payment
      FROM phi_clients c
      ORDER BY c.updated_at DESC NULLS LAST
    `;
  } else if (contractsHasClient) {
    // contracts might link to client; payments might link to contract
    const paymentsHasContract = byTable['payments']?.some((c) => c === 'contract_id');
    if (paymentsHasContract) {
      clientStatusQuery = `
        SELECT
          c.id,
          c.first_name,
          c.last_name,
          c.email,
          c.status AS current_status,
          c.portal_status,
          EXISTS (
            SELECT 1 FROM phi_contracts ct
            JOIN payments p ON p.contract_id = ct.id
            WHERE ct.client_id = c.id
            AND (p.status = 'succeeded' OR p.status = 'completed' OR p.status = 'paid')
          ) AS has_payment
        FROM phi_clients c
        ORDER BY c.updated_at DESC NULLS LAST
      `;
    } else {
      clientStatusQuery = `
        SELECT
          c.id,
          c.first_name,
          c.last_name,
          c.email,
          c.status AS current_status,
          c.portal_status,
          EXISTS (SELECT 1 FROM phi_contracts ct WHERE ct.client_id = c.id) AS has_contract
        FROM phi_clients c
        ORDER BY c.updated_at DESC NULLS LAST
      `;
    }
  } else {
    // No clear client_id on payments/invoices/contracts; still list all clients and try payments table shape
    const payCols = byTable['payments'] || [];
    console.log('No client_id found on payments/phi_invoices/phi_contracts. Payments columns:', payCols.join(', '));
    clientStatusQuery = `
      SELECT
        c.id,
        c.first_name,
        c.last_name,
        c.email,
        c.status AS current_status,
        c.portal_status,
        false AS has_payment
      FROM phi_clients c
      ORDER BY c.updated_at DESC NULLS LAST
    `;
  }

  const { rows: clients } = await pool.query<{
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    current_status: string;
    portal_status: string | null;
    has_payment: boolean;
    has_contract?: boolean;
  }>(clientStatusQuery);

  // Summary
  const withPayment = clients.filter((r) => r.has_payment);
  const withContractOnly = clients.filter((r) => (r as { has_contract?: boolean }).has_contract && !r.has_payment);
  const suggestedActiveOrComplete = withPayment.length;

  console.log('--- Client status vs payments ---\n');
  console.log(`Total clients: ${clients.length}`);
  console.log(`With at least one succeeded/paid payment: ${withPayment.length}`);
  if (withContractOnly.length > 0) console.log(`With contract only (no payment): ${withContractOnly.length}`);
  console.log('\nSuggested: clients with payments → treat as active or complete (done with services).\n');

  // Sample: first 20 with payment, then first 10 without
  console.log('Sample: clients WITH payment (first 20):');
  withPayment.slice(0, 20).forEach((r) => {
    console.log(`  ${r.id} | ${r.first_name} ${r.last_name} | ${r.email} | status=${r.current_status} | has_payment=true`);
  });
  if (withPayment.length === 0) {
    console.log('  (none)');
  }
  console.log('\nSample: clients WITHOUT payment (first 10):');
  clients.filter((r) => !r.has_payment).slice(0, 10).forEach((r) => {
    console.log(`  ${r.id} | ${r.first_name} ${r.last_name} | status=${r.current_status} | has_payment=false`);
  });

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
