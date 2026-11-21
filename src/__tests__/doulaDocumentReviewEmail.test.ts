import {
  buildDocumentReviewEmail,
  sendDocumentReviewEmail,
} from '../features/doulas/application/documentReviewEmail';
import { NodemailerService } from '../services/emailService';

const sendEmail = jest.fn();
jest.mock('../services/emailService', () => ({ NodemailerService: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  (NodemailerService as jest.Mock).mockImplementation(() => ({ sendEmail }));
  process.env.FRONTEND_URL = 'https://dev.example.test/';
});

it.each([
  ['approved', 'Sokana360: Document approved'],
  ['rejected', 'Sokana360: Document changes requested'],
] as const)(
  'emails the doula when a document is %s',
  async (status, subject) => {
    await sendDocumentReviewEmail({
      email: 'DOULA@example.test',
      fullName: 'Example Doula',
      status,
      rejectionReason:
        status === 'rejected' ? 'Upload a readable copy.' : undefined,
    });
    expect(sendEmail).toHaveBeenCalledWith(
      'doula@example.test',
      subject,
      expect.stringContaining(
        'https://dev.example.test/doula-dashboard/profile?step=documents'
      )
    );
  }
);

it('includes the rejection reason but not document-sensitive details', () => {
  const email = buildDocumentReviewEmail({
    email: 'doula@example.test',
    fullName: 'Example Doula',
    status: 'rejected',
    rejectionReason: 'Upload a readable copy.',
  });
  expect(email.body).toContain('Reason:\nUpload a readable copy.');
});
