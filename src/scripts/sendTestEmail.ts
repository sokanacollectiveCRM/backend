import 'dotenv/config';
import nodemailer from 'nodemailer';

type CliArgs = {
  to: string;
  subject: string;
  text: string;
};

function parseCliArgs(argv: string[]): CliArgs {
  const argMap: Record<string, string> = {};
  for (let i = 2; i < argv.length; i++) {
    const part = argv[i];
    if (part.startsWith('--')) {
      const key = part.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        argMap[key] = next;
        i++;
      } else {
        argMap[key] = 'true';
      }
    }
  }

  const to = argMap.to || process.env.TEST_EMAIL_TO || process.env.EMAIL_USER || '';
  const subject = argMap.subject || 'Sokana CRM Email Test';
  const text = argMap.text || 'This is a test email sent from the Sokana backend script.';

  if (!to) {
    throw new Error('Missing recipient. Provide --to you@example.com or set TEST_EMAIL_TO.');
  }

  return { to, subject, text };
}

async function main(): Promise<void> {
  const { to, subject, text } = parseCliArgs(process.argv);

  // Hardcoded SMTP settings. Update as needed.
  const HOST = 'smtp.gmail.com';
  const PORT = 465; // TLS port
  const SECURE = true;
  const USER = 'hello@sokanacollective.com';
  const PASS = 'bfrqortlirqkwvsr';
  const FROM = 'Sokana CRM <hello@sokanacollective.com>';

  // Using hardcoded PASS above for testing purposes.

  const transporter = nodemailer.createTransport({
    host: HOST,
    port: PORT,
    secure: SECURE,
    auth: { user: USER, pass: PASS },
  });

  // Log effective settings (mask the password)
  // eslint-disable-next-line no-console
  console.log('SMTP config:', {
    host: HOST,
    port: PORT,
    secure: SECURE,
    user: USER,
    from: FROM,
    to,
    subject,
    text,
    passwordPreview: PASS ? `${PASS.slice(0, 2)}***${PASS.slice(-2)}` : '<empty>'
  });

  const mailOptions = {
    from: FROM,
    to,
    subject,
    text,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    // eslint-disable-next-line no-console
    console.log('Test email sent successfully:', {
      messageId: info.messageId,
      envelope: info.envelope,
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response,
    });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error('Failed to send test email:', error);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Unexpected error in test email script:', err);
  process.exit(1);
});
