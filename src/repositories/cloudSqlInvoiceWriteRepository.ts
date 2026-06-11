import { queryCloudSql } from '../db/cloudSqlPool';

type QuickBooksInvoice = {
  Id?: string;
  DocNumber?: string;
  TotalAmt?: number;
  Balance?: number;
  DueDate?: string;
  invoiceLink?: string;
};

function computeStatus(balance: number | null | undefined): string | null {
  if (balance == null || Number.isNaN(balance)) return null;
  return balance === 0 ? 'paid' : 'pending';
}

function computePaidTotal(total: number | null | undefined, balance: number | null | undefined): number | null {
  if (total == null || balance == null) return null;
  const paid = total - balance;
  return Number.isFinite(paid) ? Math.max(0, paid) : null;
}

async function getPhiInvoicesColumns(): Promise<Set<string>> {
  const { rows } = await queryCloudSql<{ column_name: string }>(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'phi_invoices'
    `
  );
  return new Set(rows.map((r) => r.column_name));
}

export async function upsertInvoiceToCloudSql(opts: {
  internalCustomerId: string;
  invoice: QuickBooksInvoice;
}): Promise<void> {
  const { internalCustomerId, invoice } = opts;

  const qboInvoiceId = invoice.Id ? String(invoice.Id) : null;
  const invoiceNumber = invoice.DocNumber ? String(invoice.DocNumber) : null;
  const totalAmt = typeof invoice.TotalAmt === 'number' ? invoice.TotalAmt : null;
  const balanceAmt = typeof invoice.Balance === 'number' ? invoice.Balance : null;
  const dueDate = invoice.DueDate ? String(invoice.DueDate).slice(0, 10) : null;
  const invoiceLink = (invoice as any).invoiceLink ? String((invoice as any).invoiceLink) : null;

  const status = computeStatus(balanceAmt);
  const paidTotal = computePaidTotal(totalAmt, balanceAmt);

  const cols = await getPhiInvoicesColumns();

  // Always-required base fields for UI ledger.
  const columns: string[] = ['client_id'];
  const values: any[] = [internalCustomerId];

  const add = (col: string, value: any) => {
    if (!cols.has(col)) return;
    columns.push(col);
    values.push(value);
  };

  add('status', status);
  add('total_amount', totalAmt);
  add('paid_total_amount', paidTotal);
  add('due_date', dueDate);

  // Optional QB linkage fields (added via migration when available).
  add('qbo_invoice_id', qboInvoiceId);
  add('invoice_number', invoiceNumber);
  add('invoice_link', invoiceLink);
  add('balance_amount', balanceAmt);

  // Timestamps if present on the table. (created_at default is fine too.)
  const now = new Date().toISOString();
  add('updated_at', now);
  if (cols.has('created_at')) {
    // Only set created_at on insert; handled in SQL via COALESCE in conflict update.
    // We'll still include it in insert values if the table doesn't have a default.
    add('created_at', now);
  }

  const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
  const insertSql = `
    INSERT INTO public.phi_invoices (${columns.join(', ')})
    VALUES (${placeholders})
  `;

  // Best-effort upsert if a unique constraint exists on qbo_invoice_id.
  if (cols.has('qbo_invoice_id') && qboInvoiceId) {
    const updateAssignments = columns
      .filter((c) => c !== 'created_at')
      .filter((c) => c !== 'client_id') // keep original linkage unless you intentionally re-link
      .map((c) => `${c} = COALESCE(EXCLUDED.${c}, ${c})`)
      .join(', ');

    const upsertSql = `
      ${insertSql}
      ON CONFLICT (qbo_invoice_id)
      DO UPDATE SET
        client_id = EXCLUDED.client_id,
        ${updateAssignments || 'updated_at = EXCLUDED.updated_at'}
    `;

    try {
      await queryCloudSql(upsertSql, values);
      return;
    } catch (err: any) {
      const msg = String(err?.message || '');
      // If there's no unique/exclusion constraint for ON CONFLICT, fall back to insert-only.
      if (!msg.includes('ON CONFLICT') && !msg.includes('unique') && !msg.includes('exclusion')) {
        throw err;
      }
    }
  }

  // Insert-only fallback (may create duplicates if called repeatedly without QB linkage constraints).
  await queryCloudSql(insertSql, values);
}

