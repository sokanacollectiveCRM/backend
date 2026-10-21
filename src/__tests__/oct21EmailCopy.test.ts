import { buildIntakeSubmitterConfirmationEmail } from '../features/intake/notifications/intakeStaffNotificationEmail';
import { buildFamilyInvitationEmail } from '../features/portal/application/familyInvitationEmail';
import { buildStaffInvitationEmail } from '../services/staffInvitationEmail';

describe('Oct21 approved email copy', () => {
  it('matches template 1 exactly', () => {
    expect(
      buildStaffInvitationEmail({
        firstname: 'Maya',
        email: 'maya@example.com',
        setupUrl: 'https://dev.example.com/setup',
        frontendUrl: 'https://dev.example.com',
      }).text
    ).toBe(
      "Hi Maya,\n\nYou've been invited to set up your account in Sokana360, Sokana Collective's new platform for managing doula information, services, and assignments.\n\nTo complete your account setup:\n\n1. Reset your password. Click the link below to access Sokana360 and create your password.\n2. Log in. Use your email address, maya@example.com, and your new password to log in.\n3. Complete your profile. Enter all required information and upload the requested documents.\n4. Wait for review. Once you submit your information and documents, the Sokana team will review your profile. Your account is active after setup, so you can log hours, record birth outcomes, and use your assigned-work tools while your profile and documents are pending review.\n\nGet started here: https://dev.example.com/setup\n\nPlease make sure all required information is complete and all requested documents are uploaded so we can review your account.\n\nIf you have questions or need assistance with the setup process, please contact hello@sokanacollective.com\n\nThank you,\n\nSokana360"
    );
  });
  it('matches template 2 exactly', () => {
    expect(buildIntakeSubmitterConfirmationEmail('Maya').text).toBe(
      'Hi Maya,\n\nThank you for submitting a request for services with Sokana Collective. We have received your request and our team is working on your match.\n\nOur next step is to identify a doula who may be a good fit for your needs and availability. Once we identify a match, we will connect you to arrange an initial visit with the doula(s).\n\nIn the meantime, if you have any questions or need to update the information you submitted, simply reply to this email.\n\nThank you for considering Sokana Collective. We look forward to connecting with you!\n\nSokana Collective\nRemoving Barriers to Access'
    );
  });
  it('matches template 3 exactly', () => {
    expect(
      buildFamilyInvitationEmail({
        firstName: 'Maya',
        setupUrl: 'https://dev.example.com/setup',
      }).text
    ).toBe(
      "Hi Maya,\n\nWe're looking forward to supporting you and your family! Now that your service agreement has been signed, the next step is to set up your family account in Sokana360, Sokana Collective's platform for managing your care and services.\n\nPlease complete the following steps to set up your account:\n\n1. Create your password. Click the link below to access Sokana360 and reset your password.\n2. Log in. Use your email address and your new password to log in.\n3. Complete your profile. Enter any remaining required information so our team has what we need to coordinate your services.\n4. Provide your billing information. Upload the required billing information for payment or as a backup payment method, as applicable.\n5. Upload your insurance card, if applicable. If you plan to pay using insurance, upload your insurance card information. (Insurance billing will be available starting January 2027.)\n\nSet up your account here: https://dev.example.com/setup\n\nPlease complete your profile and submit all applicable information and documents as soon as possible so we can prepare for your services.\n\nIf you have questions or need help setting up your account simply reply to this email.\n\nThank you for choosing Sokana Collective. We look forward to working with you!\n\nSokana Collective\nRemoving Barriers to Access"
    );
  });
  it('escapes family template variables', () => {
    const mail = buildFamilyInvitationEmail({
      firstName: '<script>Maya</script>',
      setupUrl: 'https://dev.example.com/?a=1&b="2"',
    });
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;script&gt;');
    expect(mail.html).toContain(
      'href="https://dev.example.com/?a=1&amp;b=&quot;2&quot;"'
    );
    expect(
      buildIntakeSubmitterConfirmationEmail('<img src=x>').html
    ).not.toContain('<img');
  });
});
