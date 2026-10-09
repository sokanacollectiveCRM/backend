import nodemailer from 'nodemailer';

import { NodemailerService } from '../services/emailService';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest
      .fn()
      .mockResolvedValue({ messageId: 'billing-notification-id' }),
  }),
}));

describe('contract initiated billing email', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CONTRACT_NOTIFICATION_FROM_EMAIL = 'hello@sokanacollective.com';
    process.env.BILLING_NOTIFICATION_EMAIL = 'billing@sokanacollective.com';
    process.env.FRONTEND_URL = 'https://crm.example.com';
    process.env.BILLING_CONTRACT_VIEW_PATH_TEMPLATE =
      '/billing/contracts/:contractId';
    process.env.EMAIL_HOST = 'smtp.gmail.com';
    process.env.EMAIL_PORT = '465';
    process.env.EMAIL_SECURE = 'true';
    process.env.EMAIL_USER = 'hello@sokanacollective.com';
    process.env.EMAIL_PASSWORD = 'test-password';
  });

  it('sends billing-safe internal contract notification to configured recipient with limited billing link', async () => {
    const service = new NodemailerService();

    await service.sendContractInitiatedBillingEmail({
      clientName: 'Jane Doe',
      contractType: 'Labor Support',
      contractTotal: '$2,400.00',
      contractId: 'contract-123',
      depositAmount: '$600.00',
      installmentCount: 3,
    });

    const transporter = (nodemailer.createTransport as jest.Mock).mock
      .results[0].value;
    expect(transporter.sendMail).toHaveBeenCalledTimes(1);
    expect(transporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Sokana Billing <hello@sokanacollective.com>',
        to: 'billing@sokanacollective.com',
        subject: 'New contract initiated',
      })
    );

    const mailOptions = (transporter.sendMail as jest.Mock).mock.calls[0][0];
    expect(mailOptions.text).toContain('Client: Jane Doe');
    expect(mailOptions.text).toContain('Contract Type: Labor Support');
    expect(mailOptions.text).toContain(
      'Payment Schedule Link: https://crm.example.com/billing/contracts/contract-123'
    );
    expect(mailOptions.text).not.toContain('/admin/clients/');
    expect(mailOptions.text).not.toMatch(
      /health|pregnancy|demographic|doula assignment|care-note/i
    );
    expect(mailOptions.html).toContain(
      'https://crm.example.com/billing/contracts/contract-123'
    );
  });

  it('includes the sign-by cancel date on the native contract invitation', async () => {
    const service = new NodemailerService();
    await service.sendNativeContractInvitation({
      clientEmail: 'ada@example.test',
      clientName: 'Ada Lovelace',
      contractTitle: 'Labor Support',
      signingUrl: 'https://crm.example.com/signing#invitation=token',
      expiresAt: new Date('2026-10-04T12:00:00.000Z'),
      cancelDate: '2026-10-08',
    });
    const transporter = (
      nodemailer.createTransport as jest.Mock
    ).mock.results.at(-1).value;
    const mailOptions = transporter.sendMail.mock.calls.at(-1)[0];
    expect(mailOptions.text).toContain('2026-10-08');
    expect(mailOptions.text).toMatch(/reserve your doula/i);
  });
});
