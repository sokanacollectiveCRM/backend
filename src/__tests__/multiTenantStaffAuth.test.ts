import { User } from '../entities/User';
import authMiddleware from '../middleware/authMiddleware';
import { ROLE } from '../types';

const mockResolveSession = jest.fn();
const mockGate = jest.fn();
const mockScopedProfile = jest.fn();
const mockActive = jest.fn();
const mockSupport = jest.fn();
jest.mock('../index', () => ({
  identityTokenService: {
    resolveSessionUser: (...args: unknown[]) => mockResolveSession(...args),
  },
}));
jest.mock('../features/tenancy', () => ({
  ...jest.requireActual('../features/tenancy'),
  isTenancyEnforced: () => true,
  resolveTenantGate: (...args: unknown[]) => mockGate(...args),
  isPlatformSupportPrincipal: (...args: unknown[]) => mockSupport(...args),
}));
jest.mock('../services/identityPlatform/cloudSqlIdentityUserService', () => ({
  CloudSqlIdentityUserService: jest.fn().mockImplementation(() => ({
    findTenantUser: (...args: unknown[]) => mockScopedProfile(...args),
  })),
}));
jest.mock('../security/accountAccess', () => ({
  isCurrentAccountActive: (...args: unknown[]) => mockActive(...args),
}));
const tenant = {
  id: 'org-b',
  slug: 'org-b',
  name: 'Organization B',
  role: 'doula',
  membershipId: 'membership-b',
  platformAdmin: false,
};
let req: any;
let res: any;
let next: jest.Mock;
beforeEach(() => {
  jest.clearAllMocks();
  req = {
    cookies: {},
    headers: { 'x-session-token': 'session' },
    query: {},
    originalUrl: '/api/doulas/profile',
    path: '/profile',
    method: 'GET',
    header: () => 'org-b',
  };
  res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  next = jest.fn();
  // The initial unscoped identity may be inactive or have a higher role elsewhere.
  mockResolveSession.mockResolvedValue({
    user: new User({
      id: 'profile-a',
      email: 'doula@example.test',
      role: ROLE.ADMIN,
      account_status: 'inactive' as any,
    }),
    firebaseUid: 'shared-login',
    emailVerified: true,
  });
  mockGate.mockResolvedValue({ action: 'attach', tenant });
  mockScopedProfile.mockResolvedValue(
    new User({
      id: 'profile-b',
      email: 'doula@example.test',
      role: ROLE.DOULA,
      account_status: 'approved' as any,
    })
  );
  mockActive.mockResolvedValue(true);
});

it('resolves memberships by shared login and gives handlers the selected org profile and role', async () => {
  await authMiddleware(req, res, next);
  expect(mockGate).toHaveBeenCalledWith(
    expect.objectContaining({
      userId: 'shared-login',
      requestedTenant: 'org-b',
    })
  );
  expect(mockScopedProfile).toHaveBeenCalledWith(
    { uid: 'shared-login', email: 'doula@example.test' },
    tenant
  );
  expect(req.user).toMatchObject({ id: 'profile-b', role: ROLE.DOULA });
  expect(mockActive).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'profile-b' })
  );
  expect(next).toHaveBeenCalledTimes(1);
});

it('does not allow a membership without a profile to use another org profile', async () => {
  mockScopedProfile.mockResolvedValue(null);
  await authMiddleware(req, res, next);
  expect(res.status).toHaveBeenCalledWith(403);
  expect(next).not.toHaveBeenCalled();
});

it('requires organization selection before calling application handlers', async () => {
  mockGate.mockResolvedValue({
    action: 'deny',
    status: 409,
    error: 'Choose an organization',
    code: 'TENANT_SELECTION_REQUIRED',
  });
  await authMiddleware(req, res, next);
  expect(res.status).toHaveBeenCalledWith(409);
  expect(mockScopedProfile).not.toHaveBeenCalled();
  expect(next).not.toHaveBeenCalled();
});

it('enforces the selected organization account status', async () => {
  mockActive.mockResolvedValue(false);
  await authMiddleware(req, res, next);
  expect(res.status).toHaveBeenCalledWith(403);
  expect(next).not.toHaveBeenCalled();
});

it('enforces doula email verification even when the account is admin elsewhere', async () => {
  const session = await mockResolveSession();
  mockResolveSession.mockResolvedValue({ ...session, emailVerified: false });
  await authMiddleware(req, res, next);
  expect(res.status).toHaveBeenCalledWith(403);
  expect(res.json).toHaveBeenCalledWith(
    expect.objectContaining({ code: 'EMAIL_NOT_VERIFIED' })
  );
  expect(next).not.toHaveBeenCalled();
});

it('retains lifecycle checks for platform-support bypass requests', async () => {
  req.originalUrl = '/api/intake-forms';
  mockGate.mockResolvedValue({
    action: 'deny',
    status: 403,
    error: 'No membership',
    code: 'FORBIDDEN',
  });
  mockSupport.mockResolvedValue(true);
  mockActive.mockResolvedValue(false);
  await authMiddleware(req, res, next);
  expect(res.status).toHaveBeenCalledWith(403);
  expect(next).not.toHaveBeenCalled();
});
