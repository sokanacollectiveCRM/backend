import { RequestHandler } from 'express';

import { SAFE_INTERNAL_ERROR_MESSAGE } from '../common/utils/safeLogging';
import { quickbooksInvoiceWebhookService } from '../services/quickbooksInvoiceWebhookService';
import { claimWebhookEvent } from '../security/webhookEventStore';

function extractInvoiceId(payload: Record<string, unknown>): string | null {
  const direct =
    payload.qbo_invoice_id ??
    payload.invoiceId ??
    payload.invoice_id ??
    payload.Id ??
    payload.id;

  if (typeof direct === 'string' || typeof direct === 'number') {
    const normalized = String(direct).trim();
    return normalized || null;
  }

  const entities = payload.eventNotifications ?? payload.entities;
  if (Array.isArray(entities)) {
    for (const entity of entities) {
      const nested = extractInvoiceId(entity as Record<string, unknown>);
      if (nested) {
        return nested;
      }
      const dataChange = (entity as Record<string, unknown>).dataChangeEvent as
        | Record<string, unknown>
        | undefined;
      const innerEntities = dataChange?.entities;
      if (Array.isArray(innerEntities)) {
        for (const inner of innerEntities) {
          const id = (inner as Record<string, unknown>).id;
          const name = String((inner as Record<string, unknown>).name || '').toLowerCase();
          if (name.includes('invoice') && (typeof id === 'string' || typeof id === 'number')) {
            return String(id);
          }
        }
      }
    }
  }

  return null;
}

function extractBalance(payload: Record<string, unknown>): number | null {
  const balance = payload.balance ?? payload.Balance;
  return typeof balance === 'number' ? balance : null;
}

function extractTotal(payload: Record<string, unknown>): number | null {
  const total = payload.total_amount ?? payload.TotalAmt ?? payload.total;
  return typeof total === 'number' ? total : null;
}

function buildQuickBooksEventKey(
  req: { get?: (name: string) => string | undefined; headers?: Record<string, unknown> },
  _payload: Record<string, unknown>,
  qboInvoiceId: string,
): string {
  const intuitTid =
    (typeof req.get === 'function' ? req.get('intuit-t-id') : undefined) ??
    (req.headers?.['intuit-t-id'] as string | undefined);
  if (typeof intuitTid === 'string' && intuitTid.trim()) {
    return `qbo:tid:${intuitTid.trim()}`;
  }
  return `qbo:invoice:${qboInvoiceId}:paid`;
}

export const quickBooksInvoicePaidWebhook: RequestHandler = async (req, res) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const qboInvoiceId = extractInvoiceId(body);
    if (!qboInvoiceId) {
      res.status(400).json({ error: 'Missing QuickBooks invoice id' });
      return;
    }

    const claim = await claimWebhookEvent(
      'quickbooks',
      buildQuickBooksEventKey(req, body, qboInvoiceId),
    );
    if (claim === 'duplicate') {
      res.status(200).json({ received: true, duplicate: true });
      return;
    }

    const clientId =
      typeof body.client_id === 'string'
        ? body.client_id
        : typeof body.clientId === 'string'
          ? body.clientId
          : null;

    await quickbooksInvoiceWebhookService.handleInvoicePaid({
      qbo_invoice_id: qboInvoiceId,
      balance: extractBalance(body),
      total_amount: extractTotal(body),
      client_id: clientId,
    });

    res.status(200).json({ received: true });
  } catch {
    res.status(500).json({ error: SAFE_INTERNAL_ERROR_MESSAGE });
  }
};
