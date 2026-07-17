import { PoolClient } from 'pg';

import {
  isPaymentAuthorizationRequired,
  resolveBillingPath,
} from '../constants/portalEligibility';
import { getPool } from '../db/cloudSqlPool';
import { clientOnboardingReadinessRepository } from '../repositories/cloudSqlClientOnboardingReadinessRepository';
import { NodemailerService } from './emailService';
import buildInvoicePayload from './invoice/buildInvoicePayload';
import createInvoiceInQuickBooks from './invoice/createInvoiceInQuickBooks';
import {
  CardOnFileStatus,
  customerPaymentMethodService,
} from './payments/customerPaymentMethodService';
import { portalEligibilityService } from './portalEligibilityService';

export class InstallmentInvoiceError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message: string
  ) {
    super(message);
  }
}

export interface PaymentInstallmentView {
  id: string;
  schedule_id: string;
  installment_number: number;
  payment_type: string;
  amount: number;
  due_date: string | null;
  payment_status: string;
  qbo_invoice_id: string | null;
  qbo_invoice_status: string | null;
  payment_link: string | null;
  paid_date: string | null;
  is_overdue: boolean;
  available_action: { enabled: boolean; reason: string | null };
}

type JoinedRow = {
  id: string;
  schedule_id: string;
  schedule_status: string;
  amount: string | number;
  due_date: string | Date | null;
  status: string;
  payment_type: string | null;
  payment_number: number | null;
  is_overdue: boolean | null;
  qbo_invoice_id: string | null;
  payment_link: string | null;
  invoice_status: string | null;
  invoice_created_at: string | Date | null;
  updated_at: string | Date;
  paid_at: string | Date | null;
  client_id: string;
  qbo_customer_id: string | null;
  payment_method: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  readiness_qbo_customer_id: string | null;
};

const paidStatuses = new Set(['paid', 'completed', 'succeeded']);
const cancelledStatuses = new Set(['cancelled', 'canceled']);
const isoDate = (value: string | Date | null) =>
  value == null ? null : new Date(value).toISOString().slice(0, 10);
const BILLING_TIME_ZONE = process.env.BILLING_TIME_ZONE || 'America/New_York';
const businessDate = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: BILLING_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());

function displayStatus(row: JoinedRow): string {
  const status = String(row.status || 'pending').toLowerCase();
  if (paidStatuses.has(status)) return 'paid';
  if (cancelledStatuses.has(status)) return 'cancelled';
  if (status === 'failed') return 'failed';
  if (row.qbo_invoice_id) return 'invoiced';
  if (row.due_date && (isoDate(row.due_date) || '') < businessDate())
    return 'overdue';
  return status === 'upcoming' ? 'upcoming' : 'pending';
}

async function queryRows(
  client: PoolClient | ReturnType<typeof getPool>,
  clientId: string
): Promise<JoinedRow[]> {
  const { rows } = await client.query<JoinedRow>(
    `
    SELECT pi.id, pi.schedule_id, ps.status AS schedule_status, pi.amount, pi.due_date, pi.status,
      pi.payment_type, pi.payment_number, pi.is_overdue, pi.qbo_invoice_id, pi.payment_link,
      pi.invoice_status, pi.invoice_created_at, pi.updated_at, pi.paid_at, pc.client_id, c.qbo_customer_id,
      c.payment_method, c.first_name, c.last_name, c.email,
      cor.qb_customer_id AS readiness_qbo_customer_id
    FROM public.payment_installments pi
    JOIN public.payment_schedules ps ON ps.id = pi.schedule_id
    JOIN public.phi_contracts pc ON pc.id = ps.contract_id
    JOIN public.phi_clients c ON c.id = pc.client_id
    LEFT JOIN public.client_onboarding_readiness cor ON cor.client_id = c.id
    WHERE pc.client_id = $1::uuid
    ORDER BY pi.due_date ASC NULLS LAST, pi.payment_number ASC NULLS LAST, pi.created_at ASC`,
    [clientId]
  );
  return rows;
}

function eligibilityReason(rows: JoinedRow[], row: JoinedRow): string | null {
  if (row.schedule_status !== 'active') return 'Payment schedule is not active';
  if (paidStatuses.has(String(row.status).toLowerCase()))
    return 'Installment is already paid';
  if (cancelledStatuses.has(String(row.status).toLowerCase()))
    return 'Installment is cancelled';
  if (row.qbo_invoice_id) return 'Installment is already invoiced';
  const path = resolveBillingPath(row.payment_method);
  if (!isPaymentAuthorizationRequired(path))
    return path === 'medicaid'
      ? 'Medicaid billing does not use installment invoices'
      : 'This billing path does not use installment invoices';
  if (!row.qbo_customer_id) return 'QuickBooks customer link is missing';
  if (
    row.readiness_qbo_customer_id &&
    row.readiness_qbo_customer_id !== row.qbo_customer_id
  )
    return 'QuickBooks customer link is stale';
  const prior = rows.filter(
    (item) =>
      item.schedule_id === row.schedule_id &&
      (item.payment_number ?? 0) < (row.payment_number ?? 0)
  );
  if (
    prior.some((item) => !paidStatuses.has(String(item.status).toLowerCase()))
  )
    return 'A prior required installment remains unpaid';
  const firstEligible = rows.find(
    (item) => eligibilityReasonWithoutSequence(item) == null
  );
  if (firstEligible && firstEligible.id !== row.id)
    return 'This is not the next eligible installment';
  return null;
}

function eligibilityError(
  rows: JoinedRow[],
  row: JoinedRow
): InstallmentInvoiceError | null {
  const status = String(row.status || '').toLowerCase();
  if (row.schedule_status !== 'active')
    return new InstallmentInvoiceError(
      'SCHEDULE_NOT_ACTIVE',
      409,
      'Payment schedule is not active'
    );
  if (paidStatuses.has(status))
    return new InstallmentInvoiceError(
      'INSTALLMENT_ALREADY_PAID',
      409,
      'Installment is already paid'
    );
  if (cancelledStatuses.has(status))
    return new InstallmentInvoiceError(
      'INSTALLMENT_CANCELLED',
      409,
      'Installment is cancelled'
    );
  if (row.qbo_invoice_id)
    return new InstallmentInvoiceError(
      'INSTALLMENT_ALREADY_INVOICED',
      200,
      'Installment is already invoiced'
    );
  const path = resolveBillingPath(row.payment_method);
  if (!isPaymentAuthorizationRequired(path)) {
    const code =
      path === 'medicaid'
        ? 'MEDICAID_BILLING_PATH'
        : 'FULL_SUPPORT_BILLING_PATH';
    return new InstallmentInvoiceError(
      code,
      409,
      path === 'medicaid'
        ? 'Medicaid billing does not use installment invoices'
        : 'This billing path does not use installment invoices'
    );
  }
  if (!row.qbo_customer_id)
    return new InstallmentInvoiceError(
      'QBO_CUSTOMER_LINK_MISSING',
      409,
      'QuickBooks customer link is missing'
    );
  if (
    row.readiness_qbo_customer_id &&
    row.readiness_qbo_customer_id !== row.qbo_customer_id
  )
    return new InstallmentInvoiceError(
      'QBO_CUSTOMER_LINK_STALE',
      409,
      'QuickBooks customer link is stale'
    );
  const prior = rows.filter(
    (item) =>
      item.schedule_id === row.schedule_id &&
      (item.payment_number ?? 0) < (row.payment_number ?? 0)
  );
  if (
    prior.some((item) => !paidStatuses.has(String(item.status).toLowerCase()))
  ) {
    return new InstallmentInvoiceError(
      'PRIOR_INSTALLMENT_UNPAID',
      409,
      'A prior required installment remains unpaid'
    );
  }
  const firstEligible = rows.find(
    (item) => eligibilityReasonWithoutSequence(item) == null
  );
  if (firstEligible && firstEligible.id !== row.id)
    return new InstallmentInvoiceError(
      'NOT_NEXT_ELIGIBLE_INSTALLMENT',
      409,
      'This is not the next eligible installment'
    );
  return null;
}

function eligibilityReasonWithoutSequence(row: JoinedRow): string | null {
  if (
    row.schedule_status !== 'active' ||
    paidStatuses.has(String(row.status).toLowerCase()) ||
    cancelledStatuses.has(String(row.status).toLowerCase()) ||
    row.qbo_invoice_id
  )
    return 'not eligible';
  if (
    !isPaymentAuthorizationRequired(resolveBillingPath(row.payment_method)) ||
    !row.qbo_customer_id
  )
    return 'not eligible';
  if (
    row.readiness_qbo_customer_id &&
    row.readiness_qbo_customer_id !== row.qbo_customer_id
  )
    return 'not eligible';
  return null;
}

function toView(rows: JoinedRow[], row: JoinedRow): PaymentInstallmentView {
  const reason = eligibilityReason(rows, row);
  return {
    id: row.id,
    schedule_id: row.schedule_id,
    installment_number: row.payment_number ?? 0,
    payment_type: row.payment_type || 'installment',
    amount: Number(row.amount),
    due_date: isoDate(row.due_date),
    payment_status: displayStatus(row),
    qbo_invoice_id: row.qbo_invoice_id,
    qbo_invoice_status: row.invoice_status,
    payment_link: row.payment_link,
    paid_date: row.paid_at ? new Date(row.paid_at).toISOString() : null,
    is_overdue: displayStatus(row) === 'overdue',
    available_action: { enabled: reason == null, reason },
  };
}

function emailContent(
  row: JoinedRow,
  link: string | null,
  card: CardOnFileStatus
) {
  const name =
    [row.first_name, row.last_name].filter(Boolean).join(' ') || 'Customer';
  const amount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(row.amount));
  const due = isoDate(row.due_date) || 'the scheduled due date';
  let warning = '';
  if (card.status === 'expired')
    warning =
      'The payment method previously saved for your account appears to be expired. When paying this invoice, please select the option to save your payment method for future payments.';
  else if (card.required && card.status !== 'active')
    warning =
      'Our records show that your previous payment was completed, but your payment method is not currently saved for future installments. Your service agreement requires an authorized card to remain on file. When paying this invoice, please select the option to save your payment method for future payments.';
  const subject = warning
    ? 'Action Required — Installment Invoice and Card on File'
    : 'Sokana Collective — Upcoming Installment Invoice';
  const text = `Hello ${name},\nYour next scheduled installment of ${amount} is due on ${due}.\n${warning ? `${warning}\n` : ''}You may review and pay the invoice using the secure QuickBooks link below:\n${link || ''}\n${warning ? 'Please contact Sokana Collective if you need assistance.\n' : ''}Thank you,\nSokana Collective`;
  return { subject, text, warningIncluded: Boolean(warning) };
}

export class InstallmentInvoiceService {
  async list(clientId: string): Promise<PaymentInstallmentView[]> {
    const rows = await queryRows(getPool(), clientId);
    if (rows.length === 0) return [];
    return rows.map((row) => toView(rows, row));
  }

  async generate(clientId: string, installmentId: string, staffUserId: string) {
    const db = await getPool().connect();
    let row: JoinedRow;
    try {
      await db.query('BEGIN');
      await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        installmentId,
      ]);
      const rows = await queryRows(db, clientId);
      if (rows.length === 0) {
        throw new InstallmentInvoiceError(
          'SCHEDULE_MISSING',
          404,
          'No payment schedule exists for this client'
        );
      }
      const found = rows.find((item) => item.id === installmentId);
      if (!found)
        throw new InstallmentInvoiceError(
          'INSTALLMENT_NOT_FOUND',
          404,
          'Installment does not belong to this client'
        );
      row = found;
      if (row.qbo_invoice_id) {
        await db.query('COMMIT');
        const card =
          await customerPaymentMethodService.getCardOnFileStatus(clientId);
        return {
          ...toView(rows, row),
          card_on_file: card.on_file,
          card_warning_included: false,
          invoice_status: row.invoice_status || 'created',
        };
      }
      const eligibilityFailure = eligibilityError(rows, row);
      if (eligibilityFailure) throw eligibilityFailure;

      const itemId =
        process.env.QBO_INVOICE_ITEM_ID ||
        process.env.QBO_DEPOSIT_ITEM_ID ||
        '1';
      const description =
        `Sokana Collective Service Installment ${row.payment_number ?? ''}`.trim();
      const lineItems = [
        {
          DetailType: 'SalesItemLineDetail',
          Amount: Number(row.amount),
          Description: description,
          SalesItemLineDetail: {
            ItemRef: { value: itemId },
            UnitPrice: Number(row.amount),
            Qty: 1,
          },
        },
      ];
      const invoice = await createInvoiceInQuickBooks(
        buildInvoicePayload(row.qbo_customer_id!, {
          lineItems,
          dueDate: isoDate(row.due_date)!,
          memo: description,
          customerEmail: row.email || '',
        }),
        `installment-${installmentId}`
      );
      const invoiceId = invoice?.Id ? String(invoice.Id) : null;
      if (!invoiceId)
        throw new Error('QuickBooks did not return an invoice id');
      const paymentLink = invoice.invoiceLink
        ? String(invoice.invoiceLink)
        : null;
      await db.query(
        `UPDATE public.payment_installments SET qbo_invoice_id=$1, payment_link=$2,
        invoice_status='created', invoice_created_at=NOW(), invoice_generated_by=$3::uuid, updated_at=NOW() WHERE id=$4::uuid`,
        [invoiceId, paymentLink, staffUserId, installmentId]
      );
      await db.query('COMMIT');

      const card =
        await customerPaymentMethodService.getCardOnFileStatus(clientId);
      const content = emailContent(row, paymentLink, card);
      let invoiceStatus = 'created';
      if (row.email) {
        try {
          await new NodemailerService().sendEmail(
            row.email,
            content.subject,
            content.text
          );
          await getPool().query(
            `UPDATE public.payment_installments SET invoice_status='sent' WHERE id=$1::uuid`,
            [installmentId]
          );
          invoiceStatus = 'sent';
        } catch (error) {
          invoiceStatus = 'email_failed';
          await getPool().query(
            `UPDATE public.payment_installments SET invoice_status='email_failed' WHERE id=$1::uuid`,
            [installmentId]
          );
          await clientOnboardingReadinessRepository.recordEvent({
            client_id: clientId,
            event_type: 'installment_invoice_email_failed',
            event_source: 'staff',
            payload: {
              client_id: clientId,
              installment_id: installmentId,
              qbo_invoice_id: invoiceId,
              generated_by: staffUserId,
            },
          });
        }
      }
      await clientOnboardingReadinessRepository.recordEvent({
        client_id: clientId,
        event_type: 'installment_invoice_generated',
        event_source: 'staff',
        payload: {
          client_id: clientId,
          installment_id: installmentId,
          qbo_invoice_id: invoiceId,
          generated_by: staffUserId,
          card_on_file: card.on_file,
          card_warning_included: content.warningIncluded,
          generated_at: new Date().toISOString(),
        },
      });
      await portalEligibilityService.computeAndPersist(clientId);
      return {
        installment_id: installmentId,
        installment_number: row.payment_number ?? 0,
        payment_type: row.payment_type || 'installment',
        amount: Number(row.amount),
        due_date: isoDate(row.due_date),
        qbo_invoice_id: invoiceId,
        payment_link: paymentLink,
        card_on_file: card.on_file,
        card_warning_included: content.warningIncluded,
        invoice_status: invoiceStatus,
      };
    } catch (error) {
      await db.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      db.release();
    }
  }
}

export const installmentInvoiceService = new InstallmentInvoiceService();
