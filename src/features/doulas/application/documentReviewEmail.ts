import { logger } from '../../../common/utils/logger';
import { NodemailerService } from '../../../services/emailService';

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
      ? 'One of your uploaded documents has been approved.'
      : `One of your uploaded documents needs changes.\n\nReason:\n${input.rejectionReason?.trim()}`;
  return {
    subject,
    body: `Hi ${input.fullName.trim() || 'there'},\n\n${result}\n\nReview your documents: ${base}/doula-dashboard/profile?step=documents\n\nSokana360`,
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
