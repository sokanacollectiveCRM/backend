/**
 * Reconciliation service: match invoices and payments by amount (2 decimals).
 * Read-only; returns suggested links for client confirmation. No updates to DB.
 */

import { InvoiceRow } from '../repositories/cloudSqlInvoiceRepository';
import { PaymentRow } from '../repositories/cloudSqlPaymentRepository';
import { listInvoicesFromCloudSql } from '../repositories/cloudSqlInvoiceRepository';
import { listPaymentsFromCloudSql } from '../repositories/cloudSqlPaymentRepository';

export interface ReconciliationRow {
  invoice_id: string;
  invoice_number: string;
  invoice_customer: string;
  invoice_amount: number;
  /** Normalized for logic: "paid" | "pending" */
  invoice_status: string;
  /** Raw status from invoice table (e.g. PAID, PENDING, PARTIAL) for display */
  invoice_status_raw: string | null;
  invoice_created_at: string | null;
  invoice_due_date: string | null;
  match_type: 'amount_only' | 'amount_and_customer';
  payment_ids: string[];
  payment_customers: string[];
  payment_amounts: number[];
  payment_created_dates: (string | null)[];
}

/** Summary: invoice totals + pending/paid breakdown (from phi_invoices); payment totals; status breakdown from invoice table. No new DB columns. */
export interface ReconciliationSummary {
  // Invoice totals (phi_invoices) — pending/paid derived from invoice status
  total_invoice_amount: number;
  total_invoice_count: number;
  total_pending_amount: number;
  total_paid_amount: number;
  total_pending_count: number;
  total_paid_count: number;
  /** Counts by raw status from invoice table (e.g. { PAID: 35, PENDING: 10, PARTIAL: 5 }) for display */
  invoice_status_breakdown: Record<string, number>;
  // Payment totals (payments table)
  payment_total_amount: number;
  payment_count: number;
  payment_total_pending_amount: number;
  payment_total_paid_amount: number;
  payment_pending_count: number;
  payment_paid_count: number;
}

export interface ReconciliationResult {
  data: ReconciliationRow[];
  summary: ReconciliationSummary;
}

export interface ReconciliationFilters {
  limit?: number;
  invoice_status?: string;
  date_from?: string; // YYYY-MM-DD
  date_to?: string;   // YYYY-MM-DD
}

const ROUND = (x: number): number => Math.round(x * 100) / 100;

function parseAmount(s: string | null | undefined): number {
  if (s == null || s === '') return 0;
  const n = Number(String(s).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

function normalizeStatus(s: string | null | undefined): 'paid' | 'pending' {
  if (s == null) return 'pending';
  const u = String(s).toUpperCase().trim();
  if (u === 'PAID' || u === 'SUCCEEDED' || u === 'COMPLETED') return 'paid';
  return 'pending';
}

function normalizeCustomer(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

function sameCustomer(a: string | null | undefined, b: string | null | undefined): boolean {
  return normalizeCustomer(a) === normalizeCustomer(b) && normalizeCustomer(a) !== '';
}

export async function runReconciliation(filters: ReconciliationFilters = {}): Promise<ReconciliationResult> {
  const limit = Math.min(Math.max(1, filters.limit ?? 500), 1000);

  const [invoices, payments] = await Promise.all([
    listInvoicesFromCloudSql(limit),
    listPaymentsFromCloudSql(limit),
  ]);

  let filteredInvoices = invoices;

  // Filter by invoice status (from invoice table). Treat "PENDING" / "Pending" as normalized: include PARTIAL, PENDING, UNPAID, etc.
  if (filters.invoice_status != null && filters.invoice_status !== '') {
    const statusNorm = String(filters.invoice_status).toUpperCase().trim();
    if (statusNorm === 'PENDING') {
      filteredInvoices = filteredInvoices.filter((inv) => normalizeStatus(inv.status) === 'pending');
    } else if (statusNorm === 'PAID') {
      filteredInvoices = filteredInvoices.filter((inv) => normalizeStatus(inv.status) === 'paid');
    } else {
      filteredInvoices = filteredInvoices.filter((inv) => (inv.status ?? '').toUpperCase().trim() === statusNorm);
    }
  }

  if (filters.date_from != null && filters.date_from !== '') {
    const from = filters.date_from.slice(0, 10);
    filteredInvoices = filteredInvoices.filter((inv) => {
      const d = inv.created_at?.slice(0, 10) ?? inv.due_date ?? '';
      return d >= from;
    });
  }

  if (filters.date_to != null && filters.date_to !== '') {
    const to = filters.date_to.slice(0, 10);
    filteredInvoices = filteredInvoices.filter((inv) => {
      const d = inv.created_at?.slice(0, 10) ?? inv.due_date ?? '';
      return d <= to;
    });
  }

  const paymentByAmount = new Map<number, PaymentRow[]>();
  for (const p of payments) {
    const amt = ROUND(parseAmount(p.amount));
    if (!paymentByAmount.has(amt)) paymentByAmount.set(amt, []);
    paymentByAmount.get(amt)!.push(p);
  }

  const data: ReconciliationRow[] = [];

  for (const inv of filteredInvoices) {
    const invoiceAmountRaw = parseAmount(inv.total_amount ?? inv.paid_total_amount);
    const invoiceAmount = ROUND(invoiceAmountRaw);
    if (invoiceAmount <= 0) continue;

    const matchedPayments = paymentByAmount.get(invoiceAmount) ?? [];
    if (matchedPayments.length === 0) continue;

    const invCustomer = inv.client_name ?? inv.customer_name ?? '';
    const allSameCustomer = matchedPayments.every((p) => sameCustomer(p.client_name ?? p.customer_name, invCustomer));
    const match_type: 'amount_only' | 'amount_and_customer' = allSameCustomer ? 'amount_and_customer' : 'amount_only';

    data.push({
      invoice_id: String(inv.id ?? ''),
      invoice_number: inv.invoice_number ?? `INV-${inv.id ?? ''}`,
      invoice_customer: invCustomer,
      invoice_amount: invoiceAmount,
      invoice_status: normalizeStatus(inv.status),
      invoice_status_raw: (inv.status ?? '').trim() || null,
      invoice_created_at: inv.created_at ?? null,
      invoice_due_date: inv.due_date ?? null,
      match_type,
      payment_ids: matchedPayments.map((p) => String(p.id)),
      payment_customers: matchedPayments.map((p) => (p.client_name ?? p.customer_name ?? '').trim() || ''),
      payment_amounts: matchedPayments.map((p) => ROUND(parseAmount(p.amount))),
      payment_created_dates: matchedPayments.map((p) => p.created_at ?? null),
    });
  }

  // Invoice summary (phi_invoices only): totals + pending/paid from invoice status; raw status breakdown
  const invoicePaid = filteredInvoices.filter((i) => normalizeStatus(i.status) === 'paid');
  const invoicePending = filteredInvoices.filter((i) => normalizeStatus(i.status) === 'pending');

  const total_invoice_amount = ROUND(
    filteredInvoices.reduce((sum, i) => sum + parseAmount(i.total_amount ?? i.paid_total_amount), 0)
  );
  const total_paid_amount = ROUND(
    invoicePaid.reduce((sum, i) => sum + parseAmount(i.total_amount ?? i.paid_total_amount), 0)
  );
  const total_pending_amount = ROUND(
    invoicePending.reduce((sum, i) => sum + parseAmount(i.total_amount ?? i.paid_total_amount), 0)
  );

  const invoice_status_breakdown: Record<string, number> = {};
  for (const inv of filteredInvoices) {
    const raw = (inv.status ?? '').trim() || '(empty)';
    invoice_status_breakdown[raw] = (invoice_status_breakdown[raw] ?? 0) + 1;
  }

  // Payment summary (payments table): totals + pending/paid (status from payment row)
  const paymentPaid = payments.filter((p) => normalizeStatus(p.status) === 'paid');
  const paymentPending = payments.filter((p) => normalizeStatus(p.status) === 'pending');
  const payment_total_amount = ROUND(payments.reduce((sum, p) => sum + parseAmount(p.amount), 0));
  const payment_total_paid_amount = ROUND(paymentPaid.reduce((sum, p) => sum + parseAmount(p.amount), 0));
  const payment_total_pending_amount = ROUND(paymentPending.reduce((sum, p) => sum + parseAmount(p.amount), 0));

  const summary: ReconciliationSummary = {
    total_invoice_amount,
    total_invoice_count: filteredInvoices.length,
    total_pending_amount,
    total_paid_amount,
    total_pending_count: invoicePending.length,
    total_paid_count: invoicePaid.length,
    invoice_status_breakdown,
    payment_total_amount,
    payment_count: payments.length,
    payment_total_pending_amount,
    payment_total_paid_amount,
    payment_pending_count: paymentPending.length,
    payment_paid_count: paymentPaid.length,
  };

  return { data, summary };
}
