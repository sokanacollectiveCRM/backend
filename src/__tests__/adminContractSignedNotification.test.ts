import nodemailer from 'nodemailer';

import { NodemailerService } from '../services/emailService';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'admin-signed-id' }),
  }),
}));

describe('admin contract signed notification email', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CONTRACT_NOTIFICATION_FROM_EMAIL = 'hello@sokanacollective.com';
    process.env.CONTRACT_SIGNED_ADMIN_NOTIFICATION_EMAIL =
      'hello@sokanacollective.com';
    process.env.FRONTEND_URL = 'https://crm.example.com';
    process.env.BILLING_CONTRACT_VIEW_PATH_TEMPLATE =
      '/billing/contracts/:contractId';
    process.env.EMAIL_HOST = 'smtp.gmail.com';
    process.env.EMAIL_PORT = '465';
    process.env.EMAIL_SECURE = 'true';
    process.env.EMAIL_USER = 'hello@sokanacollective.com';
    process.env.EMAIL_PASSWORD = 'test-password';
  });

  it('notifies configured admin recipient when a contract is signed', async () => {
    const service = new NodemailerService();

    await service.sendAdminContractSignedNotification({
      clientName: 'Jane Doe',
      contractType: 'Labor Support Services',
      contractId: 'contract-123',
      contractTotal: '$2,000.00',
      signedAt: '2026-08-31T00:00:00.000Z',
    });

    const transporter = (nodemailer.createTransport as jest.Mock).mock
      .results[0].value;
    expect(transporter.sendMail).toHaveBeenCalledTimes(1);
    expect(transporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'hello@sokanacollective.com',
        subject: 'Contract signed: Jane Doe',
      })
    );

    const mailOptions = (transporter.sendMail as jest.Mock).mock.calls[0][0];
    expect(mailOptions.text).toContain('Client: Jane Doe');
    expect(mailOptions.text).toContain('Contract Type: Labor Support Services');
    expect(mailOptions.text).toContain(
      'Billing View: https://crm.example.com/billing/contracts/contract-123'
    );
  });
});
