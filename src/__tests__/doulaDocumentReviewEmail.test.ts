import { getPool } from '../db/cloudSqlPool';
import {
  buildDocumentReviewEmail,
  sendDocumentReplacementEmails,
  sendDocumentReviewEmail,
} from '../features/doulas/application/documentReviewEmail';
import { NodemailerService } from '../services/emailService';

const sendEmail = jest.fn();
jest.mock('../services/emailService', () => ({ NodemailerService: jest.fn() }));
jest.mock('../db/cloudSqlPool', () => ({ getPool: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  (NodemailerService as jest.Mock).mockImplementation(() => ({ sendEmail }));
  (getPool as jest.Mock).mockReturnValue({
    query: jest
      .fn()
      .mockResolvedValue({ rows: [{ email: 'admin@example.test' }] }),
  });
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
    expect(sendEmail.mock.calls[0][2]).toContain('Hello Example');
    expect(sendEmail.mock.calls[0][2]).toContain('your uploaded document');
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

it('uses role-specific language for replacement upload emails', async () => {
  await sendDocumentReplacementEmails({
    doulaId: 'doula-id',
    email: 'doula@example.test',
    fullName: 'Maya Rivers',
    tenantId: 'tenant-id',
  });

  expect(sendEmail).toHaveBeenCalledWith(
    'admin@example.test',
    'Sokana360: Replacement document ready for review',
    expect.stringContaining(
      'Hello Sokana team,\n\nMaya Rivers uploaded a replacement'
    )
  );
  expect(sendEmail).toHaveBeenCalledWith(
    'doula@example.test',
    'Sokana360: Replacement document received',
    expect.stringContaining(
      'Hello Maya,\n\nWe received your replacement document.'
    )
  );
});
