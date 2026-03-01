#!/usr/bin/env npx tsx
/**
 * 1) Outline active clients (assignment to doula OR past payments)
 * 2) Optionally update phi_clients.status to 'active'
 *
 * Usage:
 *   npx tsx scripts/set-active-clients-from-assignments-and-payments.ts           # Report only
 *   npx tsx scripts/set-active-clients-from-assignments-and-payments.ts --execute  # Report + update
 */
import 'dotenv/config';
import { getPool } from '../src/db/cloudSqlPool';

type ClientRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  current_status: string;
  has_assignment: boolean;
  has_payment: boolean;
  reason: string;
};

async function main() {
  const execute = process.argv.includes('--execute');
  const pool = getPool();

  // Get clients with assignment OR payment evidence
  const { rows: clients } = await pool.query<{
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    current_status: string;
    has_assignment: boolean;
    has_payment: boolean;
  }>(`
    WITH
    -- Clients with active doula assignment
    assigned AS (
      SELECT DISTINCT da.client_id
      FROM doula_assignments da
      WHERE da.client_id IS NOT NULL
    ),
    -- Clients with payment evidence (phi_invoices PAID/PARTIAL)
    paid_invoices AS (
      SELECT DISTINCT i.client_id
      FROM phi_invoices i
      WHERE i.client_id IS NOT NULL
        AND (i.status = 'PAID' OR (i.status = 'PARTIAL' AND COALESCE(i.paid_total_amount, 0) > 0))
    ),
    -- Clients with payment in payments table (contract payments)
    paid_payments AS (
      SELECT DISTINCT p.client_id
      FROM payments p
      WHERE p.client_id IS NOT NULL
    ),
    -- Clients with succeeded payment_installments (Labor Support)
    paid_installments AS (
      SELECT DISTINCT pc.client_id
      FROM phi_contracts pc
      JOIN payment_schedules ps ON ps.contract_id = pc.id
      JOIN payment_installments pi ON pi.schedule_id = ps.id
      WHERE pi.status IN ('succeeded', 'completed', 'paid')
    ),
    active_candidates AS (
      SELECT c.id
      FROM phi_clients c
      WHERE EXISTS (SELECT 1 FROM assigned a WHERE a.client_id = c.id)
         OR EXISTS (SELECT 1 FROM paid_invoices p WHERE p.client_id = c.id)
         OR EXISTS (SELECT 1 FROM paid_payments p WHERE p.client_id = c.id)
         OR EXISTS (SELECT 1 FROM paid_installments p WHERE p.client_id = c.id)
    )
    SELECT
      c.id,
      c.first_name,
      c.last_name,
      c.email,
      COALESCE(c.status, 'pending') AS current_status,
      EXISTS (SELECT 1 FROM assigned a WHERE a.client_id = c.id) AS has_assignment,
      (
        EXISTS (SELECT 1 FROM paid_invoices p WHERE p.client_id = c.id)
        OR EXISTS (SELECT 1 FROM paid_payments p WHERE p.client_id = c.id)
        OR EXISTS (SELECT 1 FROM paid_installments p WHERE p.client_id = c.id)
      ) AS has_payment
    FROM phi_clients c
    INNER JOIN active_candidates ac ON ac.id = c.id
    ORDER BY c.first_name, c.last_name
  `);

  const withReason: ClientRow[] = clients.map((r) => {
    const reasons: string[] = [];
    if (r.has_assignment) reasons.push('assigned to doula');
    if (r.has_payment) reasons.push('past payment');
    return {
      ...r,
      reason: reasons.join('; '),
    };
  });

  console.log('\n--- Active clients (assignment and/or payment) ---\n');
  console.log(`Total: ${withReason.length} client(s)\n`);

  if (withReason.length === 0) {
    console.log('No clients found with assignment or payment.');
    return;
  }

  console.log('ID                                    | Name                     | Email                          | Current status | Reason');
  console.log('-'.repeat(120));
  for (const r of withReason) {
    const name = `${(r.first_name || '').trim()} ${(r.last_name || '').trim()}`.trim().padEnd(24);
    const email = (r.email || '').padEnd(30);
    const status = (r.current_status || 'pending').padEnd(14);
    console.log(`${r.id} | ${name} | ${email} | ${status} | ${r.reason}`);
  }

  const toUpdate = withReason.filter((r) => r.current_status !== 'active');
  const alreadyActive = withReason.filter((r) => r.current_status === 'active');

  console.log('\n--- Summary ---');
  console.log(`Already status='active': ${alreadyActive.length}`);
  console.log(`Would update to 'active': ${toUpdate.length}`);

  if (execute && toUpdate.length > 0) {
    console.log('\n--- Updating status to "active" ---');
    const ids = toUpdate.map((r) => r.id);
    const { rowCount } = await pool.query(
      `UPDATE phi_clients SET status = 'active', updated_at = NOW() WHERE id = ANY($1::uuid[])`,
      [ids]
    );
    console.log(`Updated ${rowCount ?? 0} client(s) to status='active'.`);
  } else if (!execute && toUpdate.length > 0) {
    console.log('\nRun with --execute to apply updates.');
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
