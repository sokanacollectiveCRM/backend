import { cronSecretMatches } from '../http/signingReminderCron';

describe('signing reminder cron secret', () => {
  it('rejects a missing or wrong secret', () => {
    expect(cronSecretMatches(undefined, 'secret')).toBe(false);
    expect(cronSecretMatches('expected', 'other')).toBe(false);
    expect(cronSecretMatches('', 'expected')).toBe(false);
  });

  it('accepts the matching secret', () => {
    expect(cronSecretMatches('expected-secret', 'expected-secret')).toBe(true);
  });
});
