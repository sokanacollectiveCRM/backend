/**
 * Cloud SQL payments table read for GET /api/payments.
 * Table: public.payments (id, txn_date, amount, method, gateway, transaction_id, invoice, invoice_id, client_id).
 */

import { getPool } from '../db/cloudSqlPool';

export interface PaymentRow {
  id: number;
  amount: string;
  status: string | null;
  payment_type: string | null;
  type?: string | null; // alias for payment_type (UI may read either)
  created_at: string | null;
  client_id: string | null;
  client_name: string | null;
  customer_name: string | null;
  description: string | null;
  contract_id: string | null;
  invoice_id: string | null;
  invoice: string | null; // e.g. invoice number or reference for UI linking
}

export async function listPaymentsFromCloudSql(limit = 500): Promise<PaymentRow[]> {
  const pool = getPool();
  const rowShape = await queryPaymentRows(pool, limit);
  return rowShape.map((r) => mapPaymentRow(r));
}

type PaymentDbRow = {
  id: number;
  amount: string;
  txn_date: Date | null;
  method: string | null;
  gateway: string | null;
  client_id: string | null;
  first_name: string | null;
  last_name: string | null;
  invoice_id?: string | number | null;
  invoice?: string | number | null;
  contract_id?: string | null;
};

async function queryPaymentRows(pool: ReturnType<typeof getPool>, limit: number): Promise<PaymentDbRow[]> {
  const baseCols = `
    p.id, p.amount, p.txn_date, p.method, p.gateway, p.client_id,
    c.first_name, c.last_name
  `;
  const withInvoiceCols = `
    p.id, p.amount, p.txn_date, p.method, p.gateway, p.client_id,
    c.first_name, c.last_name,
    p.invoice_id, p.invoice, p.contract_id
  `;
  const sql = `
    SELECT ${withInvoiceCols}
    FROM payments p
    LEFT JOIN phi_clients c ON c.id = p.client_id
    ORDER BY p.txn_date DESC NULLS LAST, p.id DESC
    LIMIT $1
  `;
  try {
    const { rows } = await pool.query<PaymentDbRow>(sql, [limit]);
    return rows;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('column') && msg.includes('does not exist')) {
      const fallbackSql = `
        SELECT ${baseCols}
        FROM payments p
        LEFT JOIN phi_clients c ON c.id = p.client_id
        ORDER BY p.txn_date DESC NULLS LAST, p.id DESC
        LIMIT $1
      `;
      const { rows } = await pool.query<PaymentDbRow>(fallbackSql, [limit]);
      return rows;
    }
    throw err;
  }
}

function mapPaymentRow(r: PaymentDbRow): PaymentRow {
  const clientName = [r.first_name, r.last_name].filter(Boolean).join(' ').trim() || null;
  const description = [r.method, r.gateway].filter(Boolean).join(' · ') || null;
  const invoiceId = r.invoice_id != null ? String(r.invoice_id) : null;
  const invoice = r.invoice != null ? String(r.invoice) : null;
  return {
    id: r.id,
    amount: r.amount,
    status: 'completed',
    payment_type: r.method ?? null,
    type: r.method ?? null,
    created_at: r.txn_date ? new Date(r.txn_date).toISOString() : null,
    client_id: r.client_id ?? null,
    client_name: clientName,
    customer_name: clientName,
    description: description || null,
    contract_id: r.contract_id ?? null,
    invoice_id: invoiceId,
    invoice,
  };
}

/**
 * Insert a payment record into Cloud SQL payments table (e.g. after Stripe charge).
 * client_id = app client/customer UUID; amount_cents = Stripe amount in cents; transaction_id = Stripe payment intent id.
 * Does not throw if Cloud SQL is unavailable or table missing; logs and returns null.
 */
export interface InsertPaymentParams {
  client_id: string;
  amount_cents: number;
  transaction_id: string;
  description?: string | null;
}

export async function insertPaymentToCloudSql(params: InsertPaymentParams): Promise<number | null> {
  try {
    const pool = getPool();
    const amountDollars = (params.amount_cents / 100).toFixed(2);
    const sql = `
      INSERT INTO payments (txn_date, amount, method, gateway, transaction_id, client_id)
      VALUES (CURRENT_TIMESTAMP, $1, $2, $3, $4, $5)
      RETURNING id
    `;
    const { rows } = await pool.query<{ id: number }>(sql, [
      amountDollars,
      'stripe',
      'stripe',
      params.transaction_id,
      params.client_id,
    ]);
    const id = rows[0]?.id;
    if (id != null) {
      return id;
    }
    return null;
  } catch (err) {
    console.error('[Cloud SQL] insertPaymentToCloudSql failed:', err);
    return null;
  }
}
