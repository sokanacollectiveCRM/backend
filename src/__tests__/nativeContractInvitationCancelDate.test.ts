import { NodemailerService } from '../services/emailService';

describe('native contract invitation includes cancel date', () => {
  it('states the sign-by date in the initial email', async () => {
    const sendMail = jest.fn().mockResolvedValue({});
    const service = new NodemailerService();
    (service as any).transporter = { sendMail };
    process.env.USE_TEST_EMAIL = 'false';
    await service.sendNativeContractInvitation({
      clientEmail: 'client@example.test',
      clientName: 'Ada Client',
      contractTitle: 'Labor Support',
      signingUrl: 'https://example.test/sign',
      expiresAt: new Date('2026-10-04T00:00:00.000Z'),
      cancelDate: new Date('2026-10-08T00:00:00.000Z'),
    });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining('2026-10-08'),
        text: expect.stringContaining('please sign by 2026-10-08'),
      })
    );
  });
});
