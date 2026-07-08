import { getPool } from '../db/cloudSqlPool';
import { clientOnboardingReadinessRepository } from '../repositories/cloudSqlClientOnboardingReadinessRepository';
import { upsertInvoiceToCloudSql } from '../repositories/cloudSqlInvoiceWriteRepository';
import { portalEligibilityService } from './portalEligibilityService';
import { getPrimaryQuickBooksStoredPaymentMethod } from './payments/listQuickBooksStoredPaymentMethods';
import { isPaymentAuthorizationRequired } from '../constants/portalEligibility';
import { qboRequest } from '../utils/qboClient';

export interface QuickBooksInvoicePaidEvent {
  qbo_invoice_id: string;
  balance?: number | null;
  total_amount?: number | null;
  client_id?: string | null;
}

async function resolveClientIdForInvoice(qboInvoiceId: string): Promise<string | null> {
  const { rows } = await getPool().query<{ client_id: string }>(
    `SELECT client_id
     FROM public.phi_invoices
     WHERE qbo_invoice_id = $1
     LIMIT 1`,
    [qboInvoiceId]
  );
  return rows[0]?.client_id ?? null;
}

async function isDepositInvoice(qboInvoiceId: string, clientId: string): Promise<boolean> {
  const { rows } = await getPool().query<{ is_deposit: boolean }>(
    `
    SELECT EXISTS (
      SELECT 1
      FROM public.payment_installments pi
      JOIN public.payment_schedules ps ON ps.id = pi.schedule_id
      JOIN public.phi_contracts pc ON pc.id = ps.contract_id
      WHERE pc.client_id = $1::uuid
        AND COALESCE(pi.payment_type, '') = 'deposit'
        AND (
          NULLIF(to_jsonb(pi)->>'invoice_id', '') = $2
          OR NULLIF(to_jsonb(pi)->>'qbo_invoice_id', '') = $2
        )
    ) AS is_deposit
    `,
    [clientId, qboInvoiceId]
  );
  return Boolean(rows[0]?.is_deposit);
}

async function fetchQuickBooksInvoice(qboInvoiceId: string): Promise<Record<string, unknown> | null> {
  try {
    const response = await qboRequest<{ Invoice?: Record<string, unknown> }>(
      `/invoice/${encodeURIComponent(qboInvoiceId)}?minorversion=65`
    );
    return response.Invoice ?? null;
  } catch {
    return null;
  }
}

export class QuickBooksInvoiceWebhookService {
  async handleInvoicePaid(event: QuickBooksInvoicePaidEvent): Promise<void> {
    const qboInvoiceId = String(event.qbo_invoice_id || '').trim();
    if (!qboInvoiceId) {
      return;
    }

    let clientId = event.client_id ?? (await resolveClientIdForInvoice(qboInvoiceId));
    if (!clientId) {
      return;
    }

    const invoice =
      event.balance != null
        ? {
            Id: qboInvoiceId,
            TotalAmt: event.total_amount ?? undefined,
            Balance: event.balance,
          }
        : await fetchQuickBooksInvoice(qboInvoiceId);

    if (invoice) {
      await upsertInvoiceToCloudSql({
        internalCustomerId: clientId,
        invoice: invoice as { Id?: string; TotalAmt?: number; Balance?: number },
      });
    }

    const balance = event.balance ?? (typeof invoice?.Balance === 'number' ? invoice.Balance : null);
    if (balance != null && balance > 0) {
      return;
    }

    const readiness = await clientOnboardingReadinessRepository.getByClientId(clientId);
    const isVerificationInvoice =
      readiness?.verification_invoice_id === qboInvoiceId ||
      (await clientOnboardingReadinessRepository.getByVerificationInvoiceId(qboInvoiceId)) != null;

    if (isVerificationInvoice) {
      await this.handleVerificationInvoicePaid(clientId);
      return;
    }

    const depositInvoice = await isDepositInvoice(qboInvoiceId, clientId);
    if (depositInvoice || !(readiness?.deposit_paid)) {
      await this.handleDepositInvoicePaid(clientId);
    }
  }

  private async handleDepositInvoicePaid(clientId: string): Promise<void> {
    const gates = await portalEligibilityService.getOnboardingGates(clientId);
    const previous = await clientOnboardingReadinessRepository.getByClientId(clientId);

    await clientOnboardingReadinessRepository.recordEvent({
      client_id: clientId,
      event_type: 'deposit_paid',
      event_source: 'quickbooks_webhook',
    });

    const requiresAuthorization = isPaymentAuthorizationRequired(gates.billing_path);
    const storedMethod = gates.qb_customer_id
      ? await getPrimaryQuickBooksStoredPaymentMethod(gates.qb_customer_id)
      : null;

    if (requiresAuthorization && !storedMethod?.id) {
      await portalEligibilityService.computeAndPersist(clientId, {
        force_deposit_paid: true,
        event_source: 'quickbooks_webhook',
      });
      await clientOnboardingReadinessRepository.recordEvent({
        client_id: clientId,
        event_type: 'quickbooks_card_missing',
        event_source: 'quickbooks_webhook',
      });
      return;
    }

    if (storedMethod?.id) {
      await clientOnboardingReadinessRepository.recordEvent({
        client_id: clientId,
        event_type: 'card_on_file_confirmed',
        event_source: 'quickbooks_webhook',
        payload: { qb_stored_payment_method_id: storedMethod.id },
      });
    }

    const snapshot = await portalEligibilityService.computeAndPersist(clientId, {
      force_deposit_paid: true,
      event_source: 'quickbooks_webhook',
    });

    if (!previous?.is_eligible && snapshot.is_eligible) {
      await clientOnboardingReadinessRepository.recordEvent({
        client_id: clientId,
        event_type: 'portal_unlocked',
        event_source: 'quickbooks_webhook',
      });
    }
  }

  private async handleVerificationInvoicePaid(clientId: string): Promise<void> {
    const gates = await portalEligibilityService.getOnboardingGates(clientId);
    const previous = await clientOnboardingReadinessRepository.getByClientId(clientId);
    const storedMethod = gates.qb_customer_id
      ? await getPrimaryQuickBooksStoredPaymentMethod(gates.qb_customer_id)
      : null;

    const paidAt = new Date().toISOString();

    await clientOnboardingReadinessRepository.recordEvent({
      client_id: clientId,
      event_type: 'verification_invoice_paid',
      event_source: 'quickbooks_webhook',
    });

    if (!storedMethod?.id) {
      await portalEligibilityService.computeAndPersist(clientId, {
        verification_invoice_paid_at: paidAt,
        event_source: 'quickbooks_webhook',
      });
      await clientOnboardingReadinessRepository.recordEvent({
        client_id: clientId,
        event_type: 'verification_invoice_paid_no_stored_method',
        event_source: 'quickbooks_webhook',
      });
      return;
    }

    await clientOnboardingReadinessRepository.recordEvent({
      client_id: clientId,
      event_type: 'card_on_file_confirmed',
      event_source: 'quickbooks_webhook',
      payload: { qb_stored_payment_method_id: storedMethod.id },
    });

    const snapshot = await portalEligibilityService.computeAndPersist(clientId, {
      verification_invoice_paid_at: paidAt,
      event_source: 'quickbooks_webhook',
    });

    if (!previous?.is_eligible && snapshot.is_eligible) {
      await clientOnboardingReadinessRepository.recordEvent({
        client_id: clientId,
        event_type: 'portal_unlocked',
        event_source: 'quickbooks_webhook',
      });
    }
  }
}

export const quickbooksInvoiceWebhookService = new QuickBooksInvoiceWebhookService();
