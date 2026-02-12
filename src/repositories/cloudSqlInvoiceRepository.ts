/**
 * Cloud SQL phi_invoices table read for GET /api/invoices.
 * Table: public.phi_invoices (client_id, status e.g. PAID/PARTIAL, paid_total_amount, etc.).
 */

import { getPool } from '../db/cloudSqlPool';

export interface InvoiceRow {
  id: string | number | null;
  client_id: string | null;
  client_name: string | null;
  customer_name: string | null;
  status: string | null;
  total_amount: string | null;
  paid_total_amount: string | null;
  invoice_number: string | null;
  due_date: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export async function listInvoicesFromCloudSql(limit = 500): Promise<InvoiceRow[]> {
  const pool = getPool();
  const limitClamped = Math.min(Math.max(1, limit), 1000);

  // Core columns + created_at, due_date for UI. Fallback to minimal SELECT if those columns don't exist.
  const sqlWithDates = `
    SELECT
      i.id,
      i.client_id,
      i.status,
      i.paid_total_amount,
      i.total_amount,
      i.created_at,
      i.due_date,
      c.first_name,
      c.last_name
    FROM phi_invoices i
    LEFT JOIN phi_clients c ON c.id = i.client_id
    ORDER BY i.created_at DESC NULLS LAST, i.id DESC
    LIMIT $1
  `;
  const sqlMinimal = `
    SELECT
      i.id,
      i.client_id,
      i.status,
      i.paid_total_amount,
      c.first_name,
      c.last_name
    FROM phi_invoices i
    LEFT JOIN phi_clients c ON c.id = i.client_id
    ORDER BY i.id DESC
    LIMIT $1
  `;

  type Row = {
    id: string | number | null;
    client_id: string | null;
    status: string | null;
    paid_total_amount: string | number | null;
    total_amount?: string | number | null;
    first_name: string | null;
    last_name: string | null;
    created_at?: Date | string | null;
    due_date?: Date | string | null;
  };

  try {
    const { rows } = await pool.query<Row>(sqlWithDates, [limitClamped]);
    return rows.map((r) => mapInvoiceRow(r));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('phi_invoices') && (msg.includes('does not exist') || msg.includes('relation'))) {
      return [];
    }
    if (msg.includes('column') && msg.includes('does not exist')) {
      try {
        const { rows } = await pool.query<Row>(sqlMinimal, [limitClamped]);
        return rows.map((r) => mapInvoiceRow(r));
      } catch {
        return [];
      }
    }
    if (msg.includes('Cloud SQL') || msg.includes('CLOUD_SQL')) {
      return [];
    }
    throw err;
  }
}

function toIsoDate(v: Date | string | null | undefined): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  const s = String(v).trim();
  return s || null;
}

function mapInvoiceRow(r: {
  id: string | number | null;
  client_id: string | null;
  status: string | null;
  paid_total_amount: string | number | null;
  total_amount?: string | number | null;
  first_name: string | null;
  last_name: string | null;
  created_at?: Date | string | null;
  due_date?: Date | string | null;
}): InvoiceRow {
  const clientName = [r.first_name, r.last_name].filter(Boolean).join(' ').trim() || null;
  const created_at = toIsoDate(r.created_at);
  const due_date = r.due_date != null
    ? (r.due_date instanceof Date ? r.due_date.toISOString().slice(0, 10) : String(r.due_date).slice(0, 10))
    : null;
  return {
    id: r.id,
    client_id: r.client_id ?? null,
    client_name: clientName,
    customer_name: clientName,
    status: r.status ?? null,
    total_amount: r.total_amount != null ? String(r.total_amount) : null,
    paid_total_amount: r.paid_total_amount != null ? String(r.paid_total_amount) : null,
    invoice_number: null,
    due_date,
    created_at,
    updated_at: null,
  };
}
