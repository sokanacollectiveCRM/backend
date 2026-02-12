/**
 * Financial routes: reconciliation (read-only match of invoices and payments by amount).
 * GET /api/financial/reconciliation — JSON
 * GET /api/financial/reconciliation/csv — CSV export
 */

import express, { Request, Response } from 'express';
import authMiddleware from '../middleware/authMiddleware';
import authorizeRoles from '../middleware/authorizeRoles';
import { runReconciliation, ReconciliationRow } from '../services/reconciliationService';

const router = express.Router();

function getFilters(req: Request): { limit?: number; invoice_status?: string; date_from?: string; date_to?: string } {
  const limit = req.query.limit != null ? Math.min(Math.max(1, Number(req.query.limit)), 1000) : undefined;
  const invoice_status = typeof req.query.invoice_status === 'string' ? req.query.invoice_status : undefined;
  const date_from = typeof req.query.date_from === 'string' ? req.query.date_from : undefined;
  const date_to = typeof req.query.date_to === 'string' ? req.query.date_to : undefined;
  return { limit, invoice_status, date_from, date_to };
}

const reconciliationHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const filters = getFilters(req);
    const { data, summary } = await runReconciliation(filters);
    res.json({ success: true, data, summary });
  } catch (error) {
    const err = error as Error;
    console.error('Reconciliation error:', err);
    res.status(500).json({
      success: false,
      error: err?.message ?? 'Reconciliation failed',
    });
  }
};

router.get(
  '/reconciliation',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin', 'doula']),
  (req: Request, res: Response) => {
    const format = req.query.format === 'csv' || req.path.toLowerCase().endsWith('/csv');
    if (format) {
      return reconciliationCsv(req, res);
    }
    return reconciliationHandler(req, res);
  }
);

router.get(
  '/reconciliation/csv',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin', 'doula']),
  reconciliationCsv
);

async function reconciliationCsv(req: Request, res: Response): Promise<void> {
  try {
    const filters = getFilters(req);
    const { data, summary } = await runReconciliation(filters);

    const headers = [
      'invoice_id',
      'invoice_number',
      'invoice_customer',
      'invoice_amount',
      'invoice_status',
      'invoice_status_raw',
      'invoice_created_at',
      'invoice_due_date',
      'match_type',
      'payment_ids',
      'payment_customers',
      'payment_amounts',
      'payment_created_dates',
    ];

    const escape = (v: string | number | null | undefined): string => {
      if (v == null) return '';
      const s = String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const rowToCells = (r: ReconciliationRow): string[] => [
      escape(r.invoice_id),
      escape(r.invoice_number),
      escape(r.invoice_customer),
      String(r.invoice_amount),
      escape(r.invoice_status),
      escape(r.invoice_status_raw),
      escape(r.invoice_created_at),
      escape(r.invoice_due_date),
      escape(r.match_type),
      (r.payment_ids ?? []).join(';'),
      (r.payment_customers ?? []).join(';'),
      (r.payment_amounts ?? []).join(';'),
      (r.payment_created_dates ?? []).map((d) => (d ?? '')).join(';'),
    ];

    const lines: string[] = [headers.join(',')];
    for (const row of data) {
      lines.push(rowToCells(row).join(','));
    }
    lines.push('');
    lines.push('invoices,total_invoice_amount,' + summary.total_invoice_amount);
    lines.push('invoices,total_invoice_count,' + summary.total_invoice_count);
    lines.push('invoices,total_pending_amount,' + summary.total_pending_amount);
    lines.push('invoices,total_paid_amount,' + summary.total_paid_amount);
    lines.push('invoices,total_pending_count,' + summary.total_pending_count);
    lines.push('invoices,total_paid_count,' + summary.total_paid_count);
    if (summary.invoice_status_breakdown) {
      Object.entries(summary.invoice_status_breakdown).forEach(([status, count]) => {
        lines.push(`invoices,status_breakdown,${status},${count}`);
      });
    }
    lines.push('payments,payment_total_amount,' + summary.payment_total_amount);
    lines.push('payments,payment_count,' + summary.payment_count);
    lines.push('payments,payment_total_pending_amount,' + summary.payment_total_pending_amount);
    lines.push('payments,payment_total_paid_amount,' + summary.payment_total_paid_amount);
    lines.push('payments,payment_pending_count,' + summary.payment_pending_count);
    lines.push('payments,payment_paid_count,' + summary.payment_paid_count);

    const csv = lines.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="reconciliation.csv"');
    res.send(csv);
  } catch (error) {
    const err = error as Error;
    console.error('Reconciliation CSV error:', err);
    res.status(500).json({
      success: false,
      error: err?.message ?? 'Reconciliation CSV failed',
    });
  }
}

export default router;
