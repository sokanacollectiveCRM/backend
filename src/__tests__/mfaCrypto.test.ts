import {
  assertChallengeNotExpired,
  assertMfaCodeFormat,
  hashMfaValue,
  maskEmail,
} from '../services/identityPlatform/mfaCrypto';

describe('mfaCrypto', () => {
  it('hashes consistently with pepper', () => {
    expect(hashMfaValue('123456', 'pepper')).toBe(
      hashMfaValue('123456', 'pepper')
    );
    expect(hashMfaValue('123456', 'pepper')).not.toBe(
      hashMfaValue('123456', 'other')
    );
  });

  it('masks email', () => {
    expect(maskEmail('admin@sokanacollective.com')).toBe(
      'ad***@sokanacollective.com'
    );
  });

  it('validates code format', () => {
    expect(() => assertMfaCodeFormat('123456')).not.toThrow();
    expect(() => assertMfaCodeFormat('12')).toThrow();
  });

  it('rejects expired challenges', () => {
    expect(() =>
      assertChallengeNotExpired(new Date(Date.now() - 1000))
    ).toThrow(/expired/i);
  });
});
