import { getPool } from '../db/cloudSqlPool';
import { canManageHrDocuments } from '../features/doulas/application/backgroundCheck';
import { resolveTenantGate } from '../features/tenancy';
import { identityTokenService } from '../index';
import authMiddleware from '../middleware/authMiddleware';
import { hrRequestAllowed } from '../security/hrAccessBoundary';
import { CloudSqlIdentityUserService } from '../services/identityPlatform/cloudSqlIdentityUserService';
import { type AuthRequest, ROLE } from '../types';

jest.mock('../index', () => ({
  identityTokenService: { resolveSessionUser: jest.fn() },
}));
jest.mock('../db/cloudSqlPool', () => ({ getPool: jest.fn() }));
jest.mock('../features/tenancy', () => ({
  TENANT_HEADER: 'x-tenant-id',
  isTenancyEnforced: () => true,
  resolveTenantGate: jest.fn(),
  runWithTenant: (_id: string, fn: () => void) => fn(),
}));
jest.mock('../security/accountAccess', () => ({
  isCurrentAccountActive: async () => true,
}));
const response = () => {
  const r: any = {};
  r.status = jest.fn().mockReturnValue(r);
  r.json = jest.fn();
  return r;
};
beforeEach(() => {
  jest.clearAllMocks();
  (identityTokenService.resolveSessionUser as jest.Mock).mockResolvedValue({
    user: { id: 'staff', email: 'hr@example.test', role: ROLE.HR },
    emailVerified: true,
  });
  (resolveTenantGate as jest.Mock).mockResolvedValue({
    action: 'attach',
    tenant: { id: 'tenant', role: 'hr' },
  });
});
it.each([
  '/clients',
  '/api/clients',
  '/api/billing/contracts',
  '/contracts',
  '/api/payments',
  '/api/admin/staff-permissions',
  '/api/admin/doulas',
  '/users/staff',
  '/email/team-invite',
  '/clients/team/add',
  '/api/hr/doulas/one/clients',
])('denies HR direct access to %s in auth middleware', async (path) => {
  const r = response(),
    next = jest.fn();
  await authMiddleware(
    {
      headers: { authorization: 'Bearer token' },
      cookies: {},
      query: {},
      method: 'GET',
      originalUrl: path,
      path,
      url: path,
      header: () => undefined,
    } as unknown as AuthRequest,
    r,
    next
  );
  expect(r.status).toHaveBeenCalledWith(403);
  expect(next).not.toHaveBeenCalled();
});
it('allows the HR workspace route but does not promote HR via a stale admin membership', async () => {
  (resolveTenantGate as jest.Mock).mockResolvedValue({
    action: 'attach',
    tenant: { id: 'tenant', role: 'admin' },
  });
  const r = response(),
    next = jest.fn(),
    req = {
      headers: { authorization: 'Bearer token' },
      query: {},
      method: 'GET',
      originalUrl: '/api/hr/doulas',
      path: '/doulas',
      header: () => undefined,
    } as unknown as AuthRequest;
  await authMiddleware(req, r, next);
  expect(next).toHaveBeenCalled();
  expect(req.user?.role).toBe('hr');
});
it.each([
  ['GET', '/api/hr/doulas'],
  ['GET', '/api/hr/doulas/one'],
  ['GET', '/api/hr/doulas/one/documents'],
  ['GET', '/api/hr/doulas/one/documents/doc/url'],
  ['PATCH', '/api/hr/doulas/one/background-check'],
])('allows only documented HR action %s %s', (method, path) =>
  expect(hrRequestAllowed(method, path)).toBe(true)
);
it.each(['POST', 'PUT', 'DELETE'])(
  'blocks HR writes other than background status (%s)',
  (method) =>
    expect(hrRequestAllowed(method, '/api/hr/doulas/one/documents')).toBe(false)
);
it('reads HR identity from Cloud SQL and requires a persisted sensitive-file grant', async () => {
  const query = jest
    .fn()
    .mockResolvedValue({
      rows: [{ principal_id: 'staff', email: 'hr@example.test', role: 'hr' }],
      rowCount: 1,
    });
  (getPool as jest.Mock).mockReturnValue({ query });
  const user = await new CloudSqlIdentityUserService().findUser({
    uid: 'identity-uid',
    email: 'hr@example.test',
  });
  expect(query.mock.calls[0][0]).toContain("to_jsonb(a)->>'staff_role'");
  expect(user?.role).toBe(ROLE.HR);
  const req = { user, tenant: { id: 'tenant' } } as AuthRequest;
  expect(await canManageHrDocuments(req)).toBe(true);
  query.mockResolvedValue({ rows: [], rowCount: 0 });
  expect(await canManageHrDocuments(req)).toBe(false);
});
