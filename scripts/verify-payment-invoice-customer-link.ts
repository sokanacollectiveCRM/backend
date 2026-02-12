/**
 * Verify how payment records link to invoices and customers.
 * Run: npx tsx scripts/verify-payment-invoice-customer-link.ts
 * Requires CLOUD_SQL_* in .env.
 */

import 'dotenv/config';
import { getPool } from '../src/db/cloudSqlPool';

async function main() {
  const pool = getPool();

  // 0) Is there a foreign key that connects payments to phi_invoices?
  const fkRows = await pool.query<{
    constraint_name: string;
    column_name: string;
    foreign_table: string;
    foreign_column: string;
  }>(`
    SELECT
      tc.constraint_name,
      kcu.column_name,
      ccu.table_name AS foreign_table,
      ccu.column_name AS foreign_column
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name = 'payments'
    ORDER BY kcu.ordinal_position
  `);
  const paymentToInvoiceFk = fkRows.rows.find(
    (r) => r.column_name === 'invoice_id' && r.foreign_table === 'phi_invoices' && r.foreign_column === 'id'
  );
  console.log('Schema link (FK) from payments to phi_invoices:');
  if (paymentToInvoiceFk) {
    console.log('  Yes. Constraint:', paymentToInvoiceFk.constraint_name, '(payments.invoice_id → phi_invoices.id)');
  } else {
    console.log('  No foreign key found. Connection is by column convention only: payments.invoice_id = phi_invoices.id (same value).');
    if (fkRows.rows.length > 0) {
      console.log('  Other FKs on payments:', fkRows.rows.map((r) => `${r.column_name} → ${r.foreign_table}.${r.foreign_column}`).join(', '));
    }
  }

  // 1) Check if payments has invoice_id and client_id columns
  const { rows: cols } = await pool.query<{ column_name: string }>(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments'
    ORDER BY ordinal_position
  `);
  const colSet = new Set(cols.map((r) => r.column_name));
  const hasInvoiceId = colSet.has('invoice_id');
  const hasClientId = colSet.has('client_id');

  console.log('payments columns (relevant): invoice_id =', hasInvoiceId, ', client_id =', hasClientId);
  if (!hasInvoiceId && !hasClientId) {
    console.log('No invoice_id or client_id on payments. Exiting.');
    process.exit(0);
  }

  // 2) Counts
  let totalPayments = 0;
  let withClientId = 0;
  let withInvoiceId = 0;
  let withBoth = 0;
  let linkedToPhiInvoice = 0;
  let clientMatchesInvoice = 0;

  const countSql = `
    SELECT
      COUNT(*) AS total,
      COUNT(p.client_id) AS with_client_id,
      COUNT(p.invoice_id) AS with_invoice_id,
      COUNT(CASE WHEN p.client_id IS NOT NULL AND p.invoice_id IS NOT NULL THEN 1 END) AS with_both
    FROM payments p
  `;
  if (hasInvoiceId && hasClientId) {
    const r = (await pool.query(countSql)).rows[0];
    totalPayments = Number(r?.total ?? 0);
    withClientId = Number(r?.with_client_id ?? 0);
    withInvoiceId = Number(r?.with_invoice_id ?? 0);
    withBoth = Number(r?.with_both ?? 0);
  } else if (hasClientId) {
    const r = (await pool.query(`SELECT COUNT(*) AS total, COUNT(p.client_id) AS with_client_id FROM payments p`)).rows[0];
    totalPayments = Number(r?.total ?? 0);
    withClientId = Number(r?.with_client_id ?? 0);
  } else if (hasInvoiceId) {
    const r = (await pool.query(`SELECT COUNT(*) AS total, COUNT(p.invoice_id) AS with_invoice_id FROM payments p`)).rows[0];
    totalPayments = Number(r?.total ?? 0);
    withInvoiceId = Number(r?.with_invoice_id ?? 0);
  }

  console.log('\nPayment counts:');
  console.log('  Total payments:', totalPayments);
  if (hasClientId) console.log('  With client_id set:', withClientId);
  if (hasInvoiceId) console.log('  With invoice_id set:', withInvoiceId);
  if (hasClientId && hasInvoiceId) console.log('  With both client_id and invoice_id:', withBoth);

  // 3) For payments with invoice_id: how many match phi_invoices and does client match?
  const phiInvoicesExist = (await pool.query(`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'phi_invoices'
  `)).rowCount > 0;

  if (phiInvoicesExist && hasInvoiceId) {
    const linkSql = `
      SELECT
        COUNT(*) AS linked,
        COUNT(CASE WHEN p.client_id IS NOT NULL AND i.client_id IS NOT NULL AND p.client_id::text = i.client_id::text THEN 1 END) AS client_matches
      FROM payments p
      INNER JOIN phi_invoices i ON i.id = p.invoice_id
    `;
    try {
      const r = (await pool.query(linkSql)).rows[0];
      linkedToPhiInvoice = Number(r?.linked ?? 0);
      clientMatchesInvoice = Number(r?.client_matches ?? 0);
    } catch (e) {
      console.log('  (join to phi_invoices failed – id types may differ:', (e as Error).message, ')');
    }
    console.log('\nPayment ↔ phi_invoices:');
    console.log('  Payments with invoice_id that match a phi_invoices row:', linkedToPhiInvoice);
    console.log('  Of those, payment.client_id = invoice.client_id:', clientMatchesInvoice);
  }

  console.log('\nConclusion:');
  console.log('  - Customer for a payment comes from payment.client_id (phi_clients) when set.');
  console.log('  - When payment.invoice_id is set, the payment is connected to phi_invoices; that invoice has invoice.client_id (same customer).');
  console.log('  - So: payment is connected to an invoice when invoice_id is populated; the invoice record holds the client_id for that customer.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
