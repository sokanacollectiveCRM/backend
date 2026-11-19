import {
  DEFAULT_ISOLATED_ADMIN_EMAIL,
  DEFAULT_PILOT_CLIENT_EMAIL,
  DEFAULT_PILOT_CLIENT_FIRST_NAME,
  LEGACY_ISOLATED_ADMIN_EMAIL,
  isolatedAdminRow,
  isolatedPilotClientRow,
  resolveIsolatedAdminEmail,
} from '../adminLogin';
import { isProductionTarget } from '../syntheticSeed';

describe('isolated admin login helpers', () => {
  it('defaults to the real Sokana inbox for the initial Test Admin', () => {
    expect(resolveIsolatedAdminEmail(undefined)).toBe(
      DEFAULT_ISOLATED_ADMIN_EMAIL
    );
    expect(DEFAULT_ISOLATED_ADMIN_EMAIL).toBe('hello@sokanacollective.com');
  });

  it('stores the Identity Platform uid for Cloud SQL matching', () => {
    const row = isolatedAdminRow({
      email: 'Hello@sokanacollective.com',
      uid: 'firebaseUid123',
    });
    expect(row.email).toBe(DEFAULT_ISOLATED_ADMIN_EMAIL);
    expect(row.identity_platform_uid).toBe('firebaseUid123');
    expect(row.full_name).toBe('Test Admin');
    expect(row.first_name).toBe('Test Admin');
  });

  it('builds a guaranteed Maya Tester client with a deliverable plus-address', () => {
    expect(LEGACY_ISOLATED_ADMIN_EMAIL).not.toBe(DEFAULT_ISOLATED_ADMIN_EMAIL);
    const withoutLogin = isolatedPilotClientRow({});
    expect(withoutLogin.email).toBe(DEFAULT_PILOT_CLIENT_EMAIL);
    expect(withoutLogin.first_name).toBe(DEFAULT_PILOT_CLIENT_FIRST_NAME);
    expect(withoutLogin.last_name).toBe('Tester');
    expect(withoutLogin.portal_status).toBe('not_invited');
    const withLogin = isolatedPilotClientRow({ uid: 'clientUid123' });
    expect(withLogin.user_id).toBe('clientUid123');
    expect(withLogin.identity_platform_uid).toBe('clientUid123');
    expect(withLogin.portal_status).toBe('active');
  });

  it('still refuses to provision against production Cloud SQL', () => {
    expect(
      isProductionTarget({
        database: 'sokana_private',
        host: '127.0.0.1',
      })
    ).toMatch(/production database/);
  });
});
