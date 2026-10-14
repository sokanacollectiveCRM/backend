function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        character
      ]!
  );
}

export function buildFamilyInvitationEmail(input: {
  firstName: string;
  setupUrl: string;
}): { subject: string; text: string; html: string } {
  const text = `Hi ${input.firstName},

We're looking forward to supporting you and your family! Now that your service agreement has been signed, the next step is to set up your family account in Sokana360, Sokana Collective's platform for managing your care and services.

Please complete the following steps to set up your account:

1. Create your password. Click the link below to access Sokana360 and reset your password.
2. Log in. Use your email address and your new password to log in.
3. Complete your profile. Enter any remaining required information so our team has what we need to coordinate your services.
4. Provide your billing information. Upload the required billing information for payment or as a backup payment method, as applicable.
5. Upload your insurance card, if applicable. If you plan to pay using insurance, upload your insurance card information. (Insurance billing will be available starting January 2027.)

Set up your account here: ${input.setupUrl}

Please complete your profile and submit all applicable information and documents as soon as possible so we can prepare for your services.

If you have questions or need help setting up your account simply reply to this email.

Thank you for choosing Sokana Collective. We look forward to working with you!

Sokana Collective
Removing Barriers to Access`;
  const html =
    '<div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: auto;">' +
    escapeHtml(text)
      .split('\n\n')
      .map((paragraph) => '<p>' + paragraph.replace(/\n/g, '<br>') + '</p>')
      .join('') +
    '<p><a href="' +
    escapeHtml(input.setupUrl) +
    '">Set up my family account</a></p><p style="color: #777; font-size: 12px;">This link will expire in 24 hours.</p></div>';
  return {
    subject: "You're Invited to Set Up Your Sokana360 Family Account",
    text,
    html,
  };
}
