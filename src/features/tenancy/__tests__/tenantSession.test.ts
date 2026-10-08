import { SOKANA_TENANT_ID, SYNTHETIC_TENANT_ID } from '../domain/constants';
import {
  isTenantRowVisible,
  isTenantWriteAllowed,
  resolveTenantSession,
} from '../domain/tenantSession';

describe('tenant session isolation', () => {
  it('keeps enforcement off unless the process flag and bypass say otherwise', () => {
    expect(
      resolveTenantSession({
        enforce: false,
        bypass: false,
        tenantId: SOKANA_TENANT_ID,
      })
    ).toEqual({ tenantId: SOKANA_TENANT_ID, enforce: 'off' });
    expect(
      resolveTenantSession({
        enforce: true,
        bypass: true,
        tenantId: null,
      })
    ).toEqual({ tenantId: '', enforce: 'bypass' });
  });

  it('shows every row while enforcement is off and only the session tenant while it is on', () => {
    expect(
      isTenantRowVisible({
        enforce: 'off',
        sessionTenantId: SOKANA_TENANT_ID,
        rowTenantId: SYNTHETIC_TENANT_ID,
      })
    ).toBe(true);
    expect(
      isTenantRowVisible({
        enforce: 'on',
        sessionTenantId: SOKANA_TENANT_ID,
        rowTenantId: SYNTHETIC_TENANT_ID,
      })
    ).toBe(false);
    expect(
      isTenantRowVisible({
        enforce: 'on',
        sessionTenantId: SOKANA_TENANT_ID,
        rowTenantId: SOKANA_TENANT_ID,
      })
    ).toBe(true);
    expect(
      isTenantRowVisible({
        enforce: 'on',
        sessionTenantId: '',
        rowTenantId: SOKANA_TENANT_ID,
      })
    ).toBe(false);
  });

  it('blocks a write into another organization when enforcement is on', () => {
    expect(
      isTenantWriteAllowed({
        enforce: 'on',
        sessionTenantId: SOKANA_TENANT_ID,
        rowTenantId: SYNTHETIC_TENANT_ID,
      })
    ).toBe(false);
    expect(
      isTenantWriteAllowed({
        enforce: 'off',
        sessionTenantId: '',
        rowTenantId: null,
      })
    ).toBe(true);
  });
});
