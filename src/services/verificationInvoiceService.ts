import { NotFoundError, ValidationError } from '../domains/errors';
import { getPool } from '../db/cloudSqlPool';
import { isPaymentAuthorizationRequired } from '../constants/portalEligibility';
import { clientOnboardingReadinessRepository } from '../repositories/cloudSqlClientOnboardingReadinessRepository';
import createInvoiceInQuickBooks from './invoice/createInvoiceInQuickBooks';
import buildInvoicePayload from './invoice/buildInvoicePayload';
import { upsertInvoiceToCloudSql } from '../repositories/cloudSqlInvoiceWriteRepository';
import { portalEligibilityService } from './portalEligibilityService';
import { sendInvoiceEmailToCustomer } from './invoice/sendInvoiceEmail';

const VERIFICATION_MEMO = 'Payment method verification invoice';
const DEFAULT_SERVICE_ITEM_ID = process.env.QBO_VERIFICATION_ITEM_ID || '1';

export interface SendVerificationInvoiceResult {
  success: true;
  verification_invoice_id: string;
  payment_link: string | null;
  verification_invoice_sent_at: string;
}

export class VerificationInvoiceService {
  async sendVerificationInvoice(clientId: string, staffUserId: string): Promise<SendVerificationInvoiceResult> {
    const { rows } = await getPool().query<{
      id: string;
      qbo_customer_id: string | null;
      email: string | null;
      payment_method: string | null;
      first_name: string | null;
      last_name: string | null;
    }>(
      `SELECT id, qbo_customer_id, email, payment_method, first_name, last_name
       FROM public.phi_clients
       WHERE id = $1::uuid
       LIMIT 1`,
      [clientId]
    );

    const client = rows[0];
    if (!client) {
      throw new NotFoundError(`Client not found: ${clientId}`);
    }

    const snapshot = await portalEligibilityService.getPortalEligibility(clientId);
    if (snapshot.primary_portal_blocker !== 'missing_card_on_file') {
      throw new ValidationError('Client is not blocked by missing_card_on_file');
    }
    if (!isPaymentAuthorizationRequired(snapshot.billing_path)) {
      throw new ValidationError('Billing path does not require payment authorization');
    }
    if (!client.qbo_customer_id) {
      throw new ValidationError('Client is missing QuickBooks customer linkage');
    }

    const dueDate = new Date().toISOString().slice(0, 10);
    const lineItems = [
      {
        DetailType: 'SalesItemLineDetail',
        Amount: 1,
        Description: VERIFICATION_MEMO,
        SalesItemLineDetail: {
          ItemRef: { value: DEFAULT_SERVICE_ITEM_ID },
          UnitPrice: 1,
          Qty: 1,
        },
      },
    ];

    const payload = buildInvoicePayload(client.qbo_customer_id, {
      dueDate,
      memo: VERIFICATION_MEMO,
      customerEmail: client.email || '',
      lineItems,
    });

    const invoice = await createInvoiceInQuickBooks(payload);
    const qboInvoiceId = invoice?.Id ? String(invoice.Id) : null;
    if (!qboInvoiceId) {
      throw new Error('QuickBooks did not return a verification invoice id');
    }

    await upsertInvoiceToCloudSql({
      internalCustomerId: clientId,
      invoice,
    });

    if (client.email) {
      const customerName = [client.first_name, client.last_name].filter(Boolean).join(' ').trim() || 'Customer';
      await sendInvoiceEmailToCustomer({
        invoice,
        customerName,
        customerEmail: client.email,
        lineItems,
        dueDate,
        memo: VERIFICATION_MEMO,
      });
    }

    const sentAt = new Date();
    await portalEligibilityService.computeAndPersist(clientId, {
      verification_invoice_id: qboInvoiceId,
      verification_invoice_sent_at: sentAt.toISOString(),
      event_source: 'verification_invoice_service',
    });

    await clientOnboardingReadinessRepository.recordEvent({
      client_id: clientId,
      event_type: 'verification_invoice_sent',
      event_source: 'staff',
      payload: {
        staff_user_id: staffUserId,
        verification_invoice_id: qboInvoiceId,
      },
    });

    return {
      success: true,
      verification_invoice_id: qboInvoiceId,
      payment_link: invoice.invoiceLink ? String(invoice.invoiceLink) : null,
      verification_invoice_sent_at: sentAt.toISOString(),
    };
  }
}

export const verificationInvoiceService = new VerificationInvoiceService();
