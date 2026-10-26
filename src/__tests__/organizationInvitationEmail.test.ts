import { buildOrganizationInvitationEmail } from '../services/staffInvitationEmail';

it('explains accepting with the existing password and keeps organization records separate', () => {
  const m = buildOrganizationInvitationEmail({
    firstname: 'Maya <Fixture>',
    organizationName: 'Organization B',
    role: 'doula',
    acceptUrl: 'https://dev.example.test/accept-invite?token=fixture',
  });
  expect(m.text).toContain('https://dev.example.test/forgot-password');
  expect(m.html).toContain('Forgot your password? Reset password');
  expect(m.text).toContain('existing password');
  expect(m.text).toContain('password will not change');
  expect(m.text).toContain('documents remain separate');
  expect(m.text).not.toContain('Reset your password');
  expect(m.html).toContain('Maya &lt;Fixture&gt;');
  expect(m.html).toContain(
    'https://dev.example.test/accept-invite?token=fixture'
  );
});
