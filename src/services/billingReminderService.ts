import { contractNotifications } from '../config/env';
import { queryCloudSql } from '../db/cloudSqlPool';
import { NodemailerService } from './emailService';
import { getLimitedBillingContractById } from './limitedBillingContractsService';

export const BILLING_REMINDER_TEMPLATE_KEYS = [
  'past_due',
  'card_declined',
  'card_expired',
  'payment_method_update_required',
  'insufficient_funds',
  'deductible_payment_due',
  'general_billing_reminder',
] as const;

export type BillingReminderTemplateKey = typeof BILLING_REMINDER_TEMPLATE_KEYS[number];

type BillingReminderRole = 'admin' | 'billing';

export interface SendBillingReminderEmailInput {
  senderUserId: string;
  senderRole: BillingReminderRole;
  contractId: string;
  installmentNumber?: number | null;
  templateKey?: BillingReminderTemplateKey | null;
  subject?: string | null;
  message?: string | null;
  paymentIssueType?: string | null;
  clientEmail?: string | null;
  clientName?: string | null;
  dueDate?: string | null;
  amount?: number | null;
}

export interface BillingReminderEmailResult {
  emailSent: true;
  sentAt: string;
  contractId: string;
  recipient: string;
  templateKey: BillingReminderTemplateKey | null;
}

export class BillingReminderValidationError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string
  ) {
    super(message);
  }
}

function normalizeString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function formatCurrency(value?: number | null): string {
  if (value == null || !Number.isFinite(value)) return 'the scheduled amount';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

function formatDate(value?: string | null): string {
  if (!value) return 'the scheduled due date';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-US');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderMessageHtml(message: string): string {
  return escapeHtml(message).replace(/\n/g, '<br />');
}

function resolveTemplateContent(input: {
  templateKey: BillingReminderTemplateKey;
  clientName: string;
  contractType: string;
  contractId: string;
  installmentNumber?: number | null;
  dueDate?: string | null;
  amount?: number | null;
  paymentIssueType?: string | null;
}): { subject: string; message: string } {
  const firstName = input.clientName.split(' ')[0] || input.clientName;
  const amount = formatCurrency(input.amount);
  const dueDate = formatDate(input.dueDate);
  const installmentLabel =
    input.installmentNumber != null
      ? `installment #${input.installmentNumber}`
      : 'scheduled payment';

  const sharedClosing = `Please reply to this email if you have any questions or need help resolving this.\n\nReference: contract ${input.contractId}\n\nThank you,\nSokana Collective Billing`;

  switch (input.templateKey) {
    case 'past_due':
      return {
        subject: `Reminder: payment overdue for your ${input.contractType}`,
        message: `Hi ${firstName},\n\nThis is a reminder that your ${installmentLabel} for ${input.contractType} is now overdue.\nAmount: ${amount}\nDue date: ${dueDate}\n\nPlease submit payment as soon as possible or reply if you need assistance.\n\n${sharedClosing}`,
      };
    case 'card_declined':
      return {
        subject: `Payment issue: card declined for your ${input.contractType}`,
        message: `Hi ${firstName},\n\nWe attempted to process your ${installmentLabel} for ${input.contractType}, but the card on file was declined.\nAmount: ${amount}\nDue date: ${dueDate}\n\nPlease update your payment method or reply so we can help complete billing.\n\n${sharedClosing}`,
      };
    case 'card_expired':
      return {
        subject: `Payment issue: card expired for your ${input.contractType}`,
        message: `Hi ${firstName},\n\nIt looks like the card on file for your ${input.contractType} may be expired.\nAmount: ${amount}\nDue date: ${dueDate}\n\nPlease update your payment method so we can complete your ${installmentLabel}.\n\n${sharedClosing}`,
      };
    case 'payment_method_update_required':
      return {
        subject: `Payment method update needed for your ${input.contractType}`,
        message: `Hi ${firstName},\n\nYour payment method needs to be updated for your ${input.contractType}.\nAmount: ${amount}\nDue date: ${dueDate}\n\nPlease reply to this email or update your payment information at your earliest convenience.\n\n${sharedClosing}`,
      };
    case 'insufficient_funds':
      return {
        subject: `Payment issue: insufficient funds for your ${input.contractType}`,
        message: `Hi ${firstName},\n\nWe could not complete your ${installmentLabel} for ${input.contractType} because the account on file appears to need additional funds.\nAmount: ${amount}\nDue date: ${dueDate}\n\nPlease add funds or update your payment method and let us know once complete.\n\n${sharedClosing}`,
      };
    case 'deductible_payment_due':
      return {
        subject: `Reminder: deductible payment due for your ${input.contractType}`,
        message: `Hi ${firstName},\n\nThis is a reminder that your deductible-related payment for ${input.contractType} is due.\nAmount: ${amount}\nDue date: ${dueDate}\n\nPlease reply if you need a copy of the billing details or support with the payment.\n\n${sharedClosing}`,
      };
    case 'general_billing_reminder':
    default:
      return {
        subject: `Billing reminder for your ${input.contractType}`,
        message: `Hi ${firstName},\n\nWe’re reaching out about a billing item for your ${input.contractType}.\nAmount: ${amount}\nDue date: ${dueDate}\n\nPlease review and reply if you need help.\n\n${sharedClosing}`,
      };
  }
}

async function insertBillingReminderAudit(input: {
  senderUserId: string;
  senderRole: string;
  contractId: string;
  installmentNumber?: number | null;
  recipientEmail: string;
  templateKey?: string | null;
  paymentIssueType?: string | null;
  subject: string;
  message: string;
  sentAt: string;
}): Promise<void> {
  try {
    await queryCloudSql(
      `INSERT INTO public.billing_reminder_email_audit (
        contract_id,
        sender_user_id,
        sender_role,
        installment_number,
        recipient_email,
        template_key,
        payment_issue_type,
        subject,
        message,
        sent_at
      ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10::timestamptz)`,
      [
        input.contractId,
        input.senderUserId,
        input.senderRole,
        input.installmentNumber ?? null,
        input.recipientEmail,
        input.templateKey ?? null,
        input.paymentIssueType ?? null,
        input.subject,
        input.message,
        input.sentAt,
      ]
    );
  } catch (error) {
    const message = String((error as Error)?.message || '');
    if (message.includes('billing_reminder_email_audit') && (message.includes('does not exist') || message.includes('relation'))) {
      console.warn('billing_reminder_email_audit table is missing; reminder email audit row was not persisted');
      return;
    }
    throw error;
  }
}

export async function sendBillingReminderEmail(
  input: SendBillingReminderEmailInput
): Promise<BillingReminderEmailResult> {
  const contract = await getLimitedBillingContractById(input.contractId);
  if (!contract) {
    throw new BillingReminderValidationError('Billing contract not found', 404, 'NOT_FOUND');
  }

  const recipientEmail = normalizeString(contract.clientEmail);
  if (!recipientEmail) {
    throw new BillingReminderValidationError('Client email is missing for this billing contract', 400, 'MISSING_CLIENT_EMAIL');
  }

  const requestedClientEmail = normalizeString(input.clientEmail);
  if (requestedClientEmail && requestedClientEmail.toLowerCase() !== recipientEmail.toLowerCase()) {
    throw new BillingReminderValidationError('clientEmail does not match the billing-safe contract record', 400, 'CLIENT_EMAIL_MISMATCH');
  }

  const requestedClientName = normalizeString(input.clientName);
  if (requestedClientName && requestedClientName !== contract.clientName) {
    throw new BillingReminderValidationError('clientName does not match the billing-safe contract record', 400, 'CLIENT_NAME_MISMATCH');
  }

  const installment = input.installmentNumber != null
    ? contract.installments.find((item) => item.installmentNumber === input.installmentNumber)
    : undefined;

  if (input.installmentNumber != null && !installment) {
    throw new BillingReminderValidationError('Installment not found on billing contract', 400, 'INSTALLMENT_NOT_FOUND');
  }

  const templateKey = normalizeString(input.templateKey ?? null) as BillingReminderTemplateKey | null;
  if (templateKey && !BILLING_REMINDER_TEMPLATE_KEYS.includes(templateKey)) {
    throw new BillingReminderValidationError('Unsupported templateKey', 400, 'INVALID_TEMPLATE_KEY');
  }

  const defaultTemplate = templateKey
    ? resolveTemplateContent({
        templateKey,
        clientName: contract.clientName,
        contractType: contract.contractType,
        contractId: contract.contractId,
        installmentNumber: installment?.installmentNumber ?? input.installmentNumber ?? null,
        dueDate: installment?.dueDate ?? input.dueDate ?? contract.installments[0]?.dueDate ?? contract.createdAt ?? null,
        amount: installment?.amount ?? input.amount ?? contract.totalAmount,
        paymentIssueType: input.paymentIssueType ?? installment?.paymentIssueType ?? contract.paymentIssueType ?? null,
      })
    : null;

  const subject = normalizeString(input.subject) ?? defaultTemplate?.subject ?? null;
  const message = normalizeString(input.message) ?? defaultTemplate?.message ?? null;

  if (!subject) {
    throw new BillingReminderValidationError('subject is required when no template subject fallback is available', 400, 'MISSING_SUBJECT');
  }
  if (!message) {
    throw new BillingReminderValidationError('message is required when no template message fallback is available', 400, 'MISSING_MESSAGE');
  }

  const emailService = new NodemailerService();
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #333; margin-bottom: 16px;">${escapeHtml(subject)}</h2>
      <p style="color: #555; line-height: 1.6; margin: 0 0 20px 0;">${renderMessageHtml(message)}</p>
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #333;">Billing Reference</h3>
        <ul style="list-style: none; padding: 0; margin: 0;">
          <li style="margin: 10px 0;"><strong>Client:</strong> ${escapeHtml(contract.clientName)}</li>
          <li style="margin: 10px 0;"><strong>Contract Type:</strong> ${escapeHtml(contract.contractType)}</li>
          <li style="margin: 10px 0;"><strong>Contract ID:</strong> ${escapeHtml(contract.contractId)}</li>
          ${
            installment?.installmentNumber != null
              ? `<li style="margin: 10px 0;"><strong>Installment:</strong> #${installment.installmentNumber}</li>`
              : ''
          }
        </ul>
      </div>
      <p style="margin-top: 30px;">Best regards,<br />Sokana Collective Billing</p>
    </div>
  `;

  await emailService.sendEmail(
    recipientEmail,
    subject,
    message,
    html,
    { from: `Sokana Collective Billing <${contractNotifications.fromEmail}>` }
  );

  const sentAt = new Date().toISOString();
  await insertBillingReminderAudit({
    senderUserId: input.senderUserId,
    senderRole: input.senderRole,
    contractId: contract.contractId,
    installmentNumber: installment?.installmentNumber ?? input.installmentNumber ?? null,
    recipientEmail,
    templateKey,
    paymentIssueType: input.paymentIssueType ?? installment?.paymentIssueType ?? contract.paymentIssueType ?? null,
    subject,
    message,
    sentAt,
  });

  return {
    emailSent: true,
    sentAt,
    contractId: contract.contractId,
    recipient: recipientEmail,
    templateKey,
  };
}
