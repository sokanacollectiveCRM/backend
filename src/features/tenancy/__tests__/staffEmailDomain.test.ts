import {
  emailMatchesStaffDomain,
  staffInviteDomainMessage,
} from '../domain/staffEmailDomain';

describe('staff email domain', () => {
  it('accepts an address on the organization domain', () => {
    expect(
      emailMatchesStaffDomain(
        'Hello+New.Doula@SokanaCollective.com',
        '@sokanacollective.com'
      )
    ).toBe(true);
  });

  it('rejects a personal address and a lookalike domain', () => {
    expect(
      emailMatchesStaffDomain('person@gmail.com', 'sokanacollective.com')
    ).toBe(false);
    expect(
      emailMatchesStaffDomain(
        'person@sokanacollective.com.evil.test',
        'sokanacollective.com'
      )
    ).toBe(false);
    expect(
      emailMatchesStaffDomain(
        'person@mail.sokanacollective.com',
        'sokanacollective.com'
      )
    ).toBe(false);
  });

  it('names the required domain in the invite error', () => {
    expect(staffInviteDomainMessage('sokanacollective.com')).toBe(
      'Admin staff must use an @sokanacollective.com email address.'
    );
  });
});
