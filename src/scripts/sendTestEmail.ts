import 'dotenv/config';
import nodemailer from 'nodemailer';

type CliArgs = {
  to: string;
  subject: string;
  text: string;
};

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
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

  const to =
    argMap.to || process.env.TEST_EMAIL_TO || process.env.EMAIL_USER || '';
  const subject = argMap.subject || 'Sokana CRM Email Test';
  const text =
    argMap.text || 'This is a test email sent from the Sokana backend script.';

  if (!to) {
    throw new Error(
      'Missing recipient. Provide --to you@example.com or set TEST_EMAIL_TO.'
    );
  }

  return { to, subject, text };
}

/** Same env contract as NodemailerService — credentials must never be hardcoded. */
export function resolveSmtpConfigFromEnv(): SmtpConfig {
  const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.EMAIL_PORT || '465', 10);
  const secure = process.env.EMAIL_SECURE
    ? process.env.EMAIL_SECURE === 'true'
    : true;
  const user = process.env.EMAIL_USER || 'hello@sokanacollective.com';
  const pass = (process.env.EMAIL_PASSWORD || '').trim().replace(/\s+/g, '');
  const from =
    process.env.EMAIL_FROM || 'Sokana CRM <hello@sokanacollective.com>';

  if (!pass) {
    throw new Error(
      'Missing EMAIL_PASSWORD. Load from environment or Google Secret Manager; do not commit SMTP credentials.'
    );
  }

  return { host, port, secure, user, pass, from };
}

async function main(): Promise<void> {
  const { to, subject, text } = parseCliArgs(process.argv);
  const smtp = resolveSmtpConfigFromEnv();

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass },
  });

  // Log effective settings without secrets.
  // eslint-disable-next-line no-console
  console.log('SMTP config:', {
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    from: smtp.from,
    configured: Boolean(smtp.user && smtp.pass),
  });

  const mailOptions = {
    disableFileAccess: true,
    disableUrlAccess: true,
    from: smtp.from,
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

if (require.main === module) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Unexpected error in test email script:', err);
    process.exit(1);
  });
}
