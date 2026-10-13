function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character]!
  );
}

export function buildStaffInvitationEmail(input: {
  firstname: string;
  email: string;
  setupUrl: string;
  frontendUrl: string;
}): { subject: string; text: string; html: string } {
  const supportEmail = 'hello@sokanacollective.com';
  const introduction =
    'You’ve been invited to set up your account in Sokana360, Sokana Collective’s new platform for managing doula information, services, and assignments.';
  const steps = [
    [
      'Reset your password.',
      'Click the link below to access Sokana360 and create your password.',
    ],
    [
      'Log in.',
      `Use your email address, ${input.email}, and your new password to log in.`,
    ],
    [
      'Complete your profile.',
      'Enter all required information and upload the requested documents.',
    ],
    [
      'Wait for review.',
      'Once you submit your information and documents, the Sokana team will review your profile. Your account will become active once your information has been reviewed and approved.',
    ],
  ];
  const reminder =
    'Please make sure all required information is complete and all requested documents are uploaded so we can review your account.';
  const assistance =
    'If you have questions or need assistance with the setup process, please contact';
  const logoUrl = new URL('/sokana360-logo.png', input.frontendUrl).toString();
  return {
    subject: 'You’re invited to set up your Sokana360 account',
    text: `Hi ${input.firstname},\n\n${introduction}\n\nTo complete your account setup:\n\n${steps.map(([title, detail], i) => `${i + 1}. ${title} ${detail}`).join('\n')}\n\nGet started here: ${input.setupUrl}\n\n${reminder}\n\n${assistance} ${supportEmail}\n\nThank you,\n\nSokana360`,
    html: `<div style="font-family: Arial, sans-serif; color: #173d47; font-size: 16px; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 24px;">
      <p>Hi ${escapeHtml(input.firstname)},</p>
      <p>${introduction}</p>
      <p><strong>To complete your account setup:</strong></p>
      <ol style="padding-left: 24px;">${steps.map(([title, detail]) => `<li style="margin-bottom: 12px;"><strong>${title}</strong> ${escapeHtml(detail)}</li>`).join('')}</ol>
      <p><strong>Get started here:</strong> <a href="${escapeHtml(input.setupUrl)}" style="color: #0f766e; font-weight: bold;">Sokana360 Account Setup</a></p>
      <p>${reminder}</p>
      <p>${assistance} <a href="mailto:${supportEmail}" style="color: #0f766e;">${supportEmail}</a></p>
      <p>Thank you,<br><br>Sokana360</p>
      <img src="${escapeHtml(logoUrl)}" alt="Sokana360 — Connect. Care. Coordinate." width="240" style="display: block; width: 240px; max-width: 100%; height: auto; border: 0; margin-top: 20px;">
    </div>`,
  };
}
