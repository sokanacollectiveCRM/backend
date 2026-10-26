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
    "You've been invited to set up your account in Sokana360, Sokana Collective's new platform for managing doula information, services, and assignments.";
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
      'Once you submit your information and documents, the Sokana team will review your profile. Your account is active after setup, so you can log hours, record birth outcomes, and use your assigned-work tools while your profile and documents are pending review.',
    ],
  ];
  const reminder =
    'Please make sure all required information is complete and all requested documents are uploaded so we can review your account.';
  const assistance =
    'If you have questions or need assistance with the setup process, please contact';
  const logoUrl = new URL('/sokana360-logo.png', input.frontendUrl).toString();
  return {
    subject: "You're Invited to Set Up Your Sokana360 Account",
    text: `Hi ${input.firstname},\n\n${introduction}\n\nTo complete your account setup:\n\n${steps.map(([title, detail], i) => `${i + 1}. ${title} ${detail}`).join('\n')}\n\nGet started here: ${input.setupUrl}\n\n${reminder}\n\n${assistance} ${supportEmail}\n\nThank you,\n\nSokana360`,
    html: `<div style="font-family: Arial, sans-serif; color: #173d47; font-size: 16px; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 24px;">
      <p>Hi ${escapeHtml(input.firstname)},</p>
      <p>${introduction}</p>
      <p><strong>To complete your account setup:</strong></p>
      <ol style="padding-left: 24px;">${steps.map(([title, detail]) => `<li style="margin-bottom: 12px;"><strong>${title}</strong> ${escapeHtml(detail)}</li>`).join('')}</ol>
      <p><strong>Get started here:</strong> <a href="${escapeHtml(input.setupUrl)}" style="color: #0f766e; font-weight: bold;">Set up my account</a></p>
      <p>${reminder}</p>
      <p>${assistance} <a href="mailto:${supportEmail}" style="color: #0f766e;">${supportEmail}</a></p>
      <p>Thank you,<br><br>Sokana360</p>
      <img src="${escapeHtml(logoUrl)}" alt="Sokana360 — Connect. Care. Coordinate." width="240" style="display: block; width: 240px; max-width: 100%; height: auto; border: 0; margin-top: 20px;">
    </div>`,
  };
}

export function buildOrganizationInvitationEmail(input: {
  firstname: string;
  organizationName: string;
  role: string;
  acceptUrl: string;
}): { subject: string; text: string; html: string } {
  const role = input.role === 'hr' ? 'HR' : input.role;
  const instruction = `${input.organizationName} invited you to join as ${role}. Open the invitation to review and accept it. If you already have a Sokana360 account, sign in with your existing password; your password will not change. New users can create a password on the invitation page.`;
  const separation =
    'Your memberships in other organizations stay unchanged. Profiles and uploaded documents remain separate for each organization.';
  return {
    subject: `Invitation to join ${input.organizationName} on Sokana360`,
    text: `Hi ${input.firstname},\n\n${instruction}\n\nAccept invitation: ${input.acceptUrl}\n\n${separation}\n\nIf you need help, contact hello@sokanacollective.com.\n\nThank you,\nSokana360`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;line-height:1.6"><p>Hi ${escapeHtml(input.firstname)},</p><p>${escapeHtml(instruction)}</p><p><a href="${escapeHtml(input.acceptUrl)}">Review and accept invitation</a></p><p>${separation}</p><p>If you need help, contact <a href="mailto:hello@sokanacollective.com">hello@sokanacollective.com</a>.</p><p>Thank you,<br>Sokana360</p></div>`,
  };
}
