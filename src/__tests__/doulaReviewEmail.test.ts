import { getPool } from '../db/cloudSqlPool';
import { deliverProfileReviewEmails } from '../features/doulas/application/profileReviewEmail';
import { NodemailerService } from '../services/emailService';

jest.mock('../db/cloudSqlPool', () => ({ getPool: jest.fn() }));
jest.mock('../services/emailService', () => ({ NodemailerService: jest.fn() }));
const query = jest.fn(),
  sendEmail = jest.fn(),
  release = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  let selected = false;
  (getPool as jest.Mock).mockReturnValue({
    connect: async () => ({ query, release }),
  });
  (NodemailerService as jest.Mock).mockImplementation(() => ({ sendEmail }));
  query.mockImplementation(async (sql: string) => {
    if (sql.includes('FOR UPDATE SKIP LOCKED') && !selected) {
      selected = true;
      return {
        rows: [
          {
            id: 'mail',
            recipient: 'doula@example.com',
            subject: 'Changes requested',
            body: 'Fix bio',
          },
        ],
      };
    }
    return { rows: [] };
  });
});
it('marks successful delivery and does not repeat the sent row', async () => {
  await deliverProfileReviewEmails('event');
  expect(sendEmail).toHaveBeenCalledTimes(1);
  expect(query).toHaveBeenCalledWith(expect.stringContaining('sent_at=now()'), [
    'mail',
  ]);
});
it('retains failed deliveries for a later retry', async () => {
  sendEmail.mockRejectedValueOnce(new Error('SMTP offline'));
  await deliverProfileReviewEmails();
  expect(query).toHaveBeenCalledWith(
    expect.stringContaining("retry_at=now()+interval '5 minutes'"),
    ['mail']
  );
  expect(query).not.toHaveBeenCalledWith(
    expect.stringContaining('sent_at=now()'),
    ['mail']
  );
});
