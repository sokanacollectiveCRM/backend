import {
  isEmailVerificationExemptPath,
  roleRequiresVerifiedEmail,
} from '../security/emailVerificationPolicy';
import { ROLE } from '../types';

describe('email verification policy', () => {
  it('requires verification for doulas and clients only', () => {
    expect(roleRequiresVerifiedEmail(ROLE.DOULA)).toBe(true);
    expect(roleRequiresVerifiedEmail(ROLE.CLIENT)).toBe(true);
    expect(roleRequiresVerifiedEmail(ROLE.ADMIN)).toBe(false);
    expect(roleRequiresVerifiedEmail(ROLE.BILLING)).toBe(false);
  });

  it('exempts auth self-service paths', () => {
    expect(isEmailVerificationExemptPath('/auth/me')).toBe(true);
    expect(isEmailVerificationExemptPath('/auth/send-email-verification')).toBe(
      true
    );
    expect(isEmailVerificationExemptPath('/api/doulas/clients')).toBe(false);
  });
});
