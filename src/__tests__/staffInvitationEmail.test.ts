import { buildStaffInvitationEmail } from '../services/staffInvitationEmail';

describe('staff invitation email', () => {
  it('personalizes both formats, preserves the secure link, and puts the logo after the sign-off', () => {
    const result = buildStaffInvitationEmail({
      firstname: 'Maya <Test>',
      email: 'maya@example.com',
      setupUrl:
        'https://dev.example.com/signup?oobCode=example&mode=resetPassword',
      frontendUrl: 'https://dev.example.com',
    });
    expect(result.text).toContain('Hi Maya <Test>,');
    expect(result.text).toContain('Use your email address, maya@example.com,');
    expect(result.text).toContain('4. Wait for review.');
    expect(result.text).toContain(
      'https://dev.example.com/signup?oobCode=example&mode=resetPassword'
    );
    expect(result.html).toContain('Hi Maya &lt;Test&gt;,');
    expect(result.html).toContain(
      'href="https://dev.example.com/signup?oobCode=example&amp;mode=resetPassword"'
    );
    expect(result.html).toContain(
      'src="https://dev.example.com/sokana360-logo.png"'
    );
    expect(result.html).toContain(
      'alt="Sokana360 — Connect. Care. Coordinate."'
    );
    expect(result.html.indexOf('<img')).toBeGreaterThan(
      result.html.indexOf('Thank you,')
    );
    expect(result.html).toContain('mailto:hello@sokanacollective.com');
  });
});
