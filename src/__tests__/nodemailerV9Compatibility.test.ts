import nodemailer from 'nodemailer';

describe('Nodemailer 9 compatibility', () => {
  it('renders the SMTP message shapes used by the application', async () => {
    const transporter = nodemailer.createTransport({
      streamTransport: true,
      buffer: true,
      newline: 'unix',
    });

    const info = await transporter.sendMail({
      disableFileAccess: true,
      disableUrlAccess: true,
      from: 'Sokana CRM <sender@example.com>',
      to: 'client@example.com',
      bcc: 'archive@example.com',
      subject: 'Nodemailer 9 compatibility',
      text: 'Attached is your signed contract.',
      html: '<p>Attached is your signed contract.</p>',
      attachments: [
        {
          filename: 'signed-contract.pdf',
          content: Buffer.from('%PDF-1.7 test document'),
          contentType: 'application/pdf',
        },
      ],
    });

    expect(info.envelope).toEqual({
      from: 'sender@example.com',
      to: ['client@example.com', 'archive@example.com'],
    });
    expect(Buffer.isBuffer(info.message)).toBe(true);

    const message = (info.message as Buffer).toString('utf8');
    expect(message).toContain('Subject: Nodemailer 9 compatibility');
    expect(message).toContain('Content-Type: application/pdf');
    expect(message).toContain('filename=signed-contract.pdf');
  });

  it('blocks message-level raw file access', async () => {
    const transporter = nodemailer.createTransport({
      streamTransport: true,
      buffer: true,
    });

    await expect(
      transporter.sendMail({
        disableFileAccess: true,
        disableUrlAccess: true,
        from: 'sender@example.com',
        to: 'client@example.com',
        subject: 'Blocked raw content',
        raw: { path: '/etc/passwd' },
      } as any)
    ).rejects.toMatchObject({ code: 'EFILEACCESS' });
  });
});
