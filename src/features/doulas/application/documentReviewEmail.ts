import { logger } from '../../../common/utils/logger';
import { getPool } from '../../../db/cloudSqlPool';
import { NodemailerService } from '../../../services/emailService';
import { findDoulaReviewAdminEmails } from './profileReviewEmail';

export type DocumentReviewEmailInput = {
  email: string;
  fullName: string;
  status: 'approved' | 'rejected';
  rejectionReason?: string;
};

export function buildDocumentReviewEmail(input: DocumentReviewEmailInput): {
  subject: string;
  body: string;
} {
  const base = (process.env.FRONTEND_URL || 'http://localhost:3001').replace(
    /\/+$/,
    ''
  );
  const subject =
    input.status === 'approved'
      ? 'Sokana360: Document approved'
      : 'Sokana360: Document changes requested';
  const result =
    input.status === 'approved'
      ? 'The Sokana team reviewed and approved one of your uploaded documents.'
      : `The Sokana team reviewed one of your uploaded documents and requested changes.\n\nReason:\n${input.rejectionReason?.trim()}`;
  return {
    subject,
    body: `Hello ${input.fullName.trim().split(/\s+/)[0] || 'Doula'},\n\n${result}\n\nReview your documents: ${base}/doula-dashboard/profile?step=documents\n\nSokana360`,
  };
}

export async function sendDocumentReviewEmail(
  input: DocumentReviewEmailInput
): Promise<void> {
  const message = buildDocumentReviewEmail(input);
  try {
    await new NodemailerService().sendEmail(
      input.email.trim().toLowerCase(),
      message.subject,
      message.body
    );
  } catch (error) {
    logger.error(
      {
        service: 'doula-document-review',
        operation: 'send_review_email',
        errorCode: 'DOCUMENT_REVIEW_EMAIL_FAILURE',
      },
      'Document review saved but notification email failed'
    );
    throw error;
  }
}

export async function sendDocumentReplacementEmails(input: {
  doulaId: string;
  email?: string;
  fullName?: string;
  tenantId?: string;
}): Promise<void> {
  const base = (process.env.FRONTEND_URL || 'http://localhost:3001').replace(
    /\/+$/,
    ''
  );
  const email = input.email?.trim().toLowerCase();
  const fullName = input.fullName?.trim() || 'The doula';
  const firstName = fullName.split(/\s+/)[0] || 'Doula';
  const send = async (recipient: string, subject: string, body: string) =>
    new NodemailerService().sendEmail(recipient, subject, body);

  const notifyAdmins = async () => {
    if (!input.tenantId)
      throw new Error('Missing organization for document review');
    const { rows } = await findDoulaReviewAdminEmails(
      getPool(),
      input.tenantId
    );
    const recipients = rows.filter((row) => row.email !== email);
    if (!recipients.length)
      throw new Error('Missing document review recipient');
    const results = await Promise.allSettled(
      recipients.map(({ email: recipient }) =>
        send(
          recipient,
          'Sokana360: Replacement document ready for review',
          `Hello Sokana team,\n\n${fullName} uploaded a replacement for a rejected document. The replacement is ready for admin review.\n\nReview in Teams: ${base}/team?review=${encodeURIComponent(input.doulaId)}\n\nSokana360`
        )
      )
    );
    if (results.some((result) => result.status === 'rejected')) {
      throw new Error('Document review notification failed');
    }
  };

  const notifyDoula = async () => {
    if (!email) throw new Error('Missing doula email');
    await send(
      email,
      'Sokana360: Replacement document received',
      `Hello ${firstName},\n\nWe received your replacement document. You completed the replacement upload, and the document has been sent to the Sokana team for review.\n\nView your documents: ${base}/doula-dashboard/profile?step=documents\n\nSokana360`
    );
  };

  const results = await Promise.allSettled([notifyAdmins(), notifyDoula()]);
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      logger.error(
        {
          doulaId: input.doulaId,
          recipientRole: index === 0 ? 'admin' : 'doula',
        },
        'Replacement document saved but notification email failed'
      );
    }
  });
}
