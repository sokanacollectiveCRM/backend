import { SOKANA_TENANT_ID, SYNTHETIC_TENANT_ID } from '../domain/constants';
import { gateTenantResolution } from '../domain/gateTenantResolution';
import {
  resolveActiveMembership,
  selectMembershipCandidates,
} from '../domain/resolveActiveMembership';
import type { MembershipRecord } from '../domain/types';

function membership(
  overrides: Partial<MembershipRecord> &
    Pick<MembershipRecord, 'id' | 'tenantId' | 'slug' | 'role'>
): MembershipRecord {
  return {
    name: overrides.slug,
    tenantStatus: 'active',
    principalId: 'principal-1',
    linkedUserId: null,
    identityPlatformUid: null,
    email: 'person@example.com',
    status: 'active',
    ...overrides,
  };
}

const sokanaAdmin = membership({
  id: 'm-admin',
  tenantId: SOKANA_TENANT_ID,
  slug: 'sokana360',
  name: 'Sokana360',
  role: 'admin',
  principalId: 'admin-1',
  email: 'admin@example.com',
});

const sokanaDoula = membership({
  id: 'm-doula',
  tenantId: SOKANA_TENANT_ID,
  slug: 'sokana360',
  name: 'Sokana360',
  role: 'doula',
  principalId: 'doula-1',
  email: 'admin@example.com',
});

const otherAdmin = membership({
  id: 'm-other',
  tenantId: SYNTHETIC_TENANT_ID,
  slug: 'synthetic-tenant-b',
  name: 'Synthetic Tenant B',
  role: 'admin',
  principalId: 'admin-1',
  email: 'admin@example.com',
});

describe('selectMembershipCandidates', () => {
  it('uses the principal id and ignores a same-email row of another person', () => {
    const otherClient = membership({
      id: 'm-client',
      tenantId: SOKANA_TENANT_ID,
      slug: 'sokana360',
      role: 'client',
      principalId: 'client-9',
      email: 'admin@example.com',
    });
    const selected = selectMembershipCandidates([otherClient, sokanaAdmin], {
      userId: 'admin-1',
      email: 'admin@example.com',
    });
    expect(selected.map((row) => row.id)).toEqual(['m-admin']);
  });

  it('matches a portal user id stored separately from the client row id', () => {
    const client = membership({
      id: 'm-client',
      tenantId: SOKANA_TENANT_ID,
      slug: 'sokana360',
      role: 'client',
      principalId: 'client-row',
      linkedUserId: 'portal-user',
      email: 'family@example.com',
    });
    const selected = selectMembershipCandidates([client], {
      userId: 'portal-user',
      email: 'family@example.com',
    });
    expect(selected).toEqual([client]);
  });
});

describe('resolveActiveMembership', () => {
  it('attaches the only organization without a tenant header', () => {
    const resolution = resolveActiveMembership({
      candidates: [sokanaAdmin],
      currentRole: 'admin',
    });
    expect(resolution).toEqual({ status: 'ok', membership: sokanaAdmin });
  });

  it('keeps the current role when one organization has several memberships', () => {
    const resolution = resolveActiveMembership({
      candidates: [sokanaDoula, sokanaAdmin],
      currentRole: 'doula',
    });
    expect(resolution).toEqual({ status: 'ok', membership: sokanaDoula });
  });

  it('asks for a choice when the person belongs to two organizations', () => {
    const resolution = resolveActiveMembership({
      candidates: [sokanaAdmin, otherAdmin],
      currentRole: 'admin',
    });
    expect(resolution.status).toBe('selection_required');
    if (resolution.status !== 'selection_required') return;
    expect(resolution.tenants.map((tenant) => tenant.slug).sort()).toEqual([
      'sokana360',
      'synthetic-tenant-b',
    ]);
  });

  it('accepts a tenant slug the person belongs to', () => {
    const resolution = resolveActiveMembership({
      candidates: [sokanaAdmin, otherAdmin],
      requestedTenant: 'synthetic-tenant-b',
      currentRole: 'admin',
    });
    expect(resolution).toEqual({ status: 'ok', membership: otherAdmin });
  });

  it('rejects a tenant the person does not belong to', () => {
    expect(
      resolveActiveMembership({
        candidates: [sokanaAdmin],
        requestedTenant: SYNTHETIC_TENANT_ID,
      }).status
    ).toBe('forbidden');
  });

  it('denies an inactive membership', () => {
    expect(
      resolveActiveMembership({
        candidates: [membership({ ...sokanaAdmin, status: 'inactive' })],
      }).status
    ).toBe('inactive');
  });
});

describe('gateTenantResolution', () => {
  it('leaves the request unchanged when enforcement is off and no membership exists', () => {
    expect(
      gateTenantResolution({
        enforce: false,
        resolution: { status: 'none' },
      })
    ).toEqual({ action: 'continue' });
  });

  it('requires a membership once enforcement is on', () => {
    const gate = gateTenantResolution({
      enforce: true,
      resolution: { status: 'none' },
    });
    expect(gate).toMatchObject({
      action: 'deny',
      status: 403,
      code: 'FORBIDDEN',
    });
  });

  it('returns the organization list when several memberships are active', () => {
    const gate = gateTenantResolution({
      enforce: true,
      resolution: {
        status: 'selection_required',
        tenants: [
          {
            id: SOKANA_TENANT_ID,
            slug: 'sokana360',
            name: 'Sokana360',
          },
        ],
      },
    });
    expect(gate).toMatchObject({
      action: 'deny',
      status: 409,
      code: 'TENANT_SELECTION_REQUIRED',
    });
  });

  it('never marks an organization admin as a platform admin', () => {
    const gate = gateTenantResolution({
      enforce: true,
      resolution: { status: 'ok', membership: sokanaAdmin },
    });
    expect(gate).toMatchObject({
      action: 'attach',
      tenant: { platformAdmin: false, id: SOKANA_TENANT_ID, role: 'admin' },
    });
  });
});
