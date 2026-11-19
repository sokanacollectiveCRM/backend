import express from 'express';
import request from 'supertest';

import {
  AuthenticationError,
  AuthorizationError,
  ConflictError,
} from '../../../domains/errors';
import authRoutes from '../../auth/http/authRoutes';
import {
  acceptStaffInvitation,
  previewStaffInvitation,
} from '../application/staffInvitationService';

jest.mock('../../../index', () => ({ authController: {} }));
jest.mock('../../../middleware/authMiddleware', () => ({
  __esModule: true,
  default: jest.fn(),
  getSessionToken: (req: any) => req.headers['x-session-token'],
}));
jest.mock('../application/staffInvitationService', () => ({
  acceptStaffInvitation: jest.fn(),
  previewStaffInvitation: jest.fn(),
}));
const accept = acceptStaffInvitation as jest.Mock;
const preview = previewStaffInvitation as jest.Mock;
const app = express();
app.use(express.json());
app.use('/auth', authRoutes);
beforeEach(() => jest.resetAllMocks());

it('tells an existing user to sign in instead of reporting an email collision', async () => {
  accept.mockRejectedValue(
    new AuthenticationError(
      'Sign in to your existing account to accept this invitation.'
    )
  );
  const result = await request(app)
    .post('/auth/invitations/accept')
    .send({ token: 'invite' });
  expect(result.status).toBe(401);
  expect(result.body.code).toBe('EXISTING_ACCOUNT_SIGN_IN_REQUIRED');
});

it('passes verified-session credentials independently of the invited tenant', async () => {
  accept.mockResolvedValue({
    requiresEmailVerification: false,
    organizationName: 'Sokana 360',
  });
  const result = await request(app)
    .post('/auth/invitations/accept')
    .set('x-session-token', 'session')
    .send({ token: 'invite' });
  expect(accept).toHaveBeenCalledWith({
    token: 'invite',
    password: '',
    identityToken: 'session',
  });
  expect(result.status).toBe(200);
  expect(result.body).toMatchObject({
    requiresEmailVerification: false,
    organizationName: 'Sokana 360',
  });
  expect(result.body.message).toContain('existing account');
});

it('supports an ID token from existing-account sign-in', async () => {
  accept.mockResolvedValue({
    requiresEmailVerification: false,
    organizationName: 'Sokana 360',
  });
  await request(app)
    .post('/auth/invitations/accept')
    .send({ token: 'invite', idToken: 'id-token' });
  expect(accept).toHaveBeenCalledWith(
    expect.objectContaining({ identityToken: 'id-token' })
  );
});

it('returns a forbidden response when another account tries to accept', async () => {
  accept.mockRejectedValue(
    new AuthorizationError('Sign in with the invited email.')
  );
  const result = await request(app)
    .post('/auth/invitations/accept')
    .send({ token: 'invite' });
  expect(result.status).toBe(403);
});

it('preserves a specific duplicate-membership message', async () => {
  accept.mockRejectedValue(
    new ConflictError('This email is already a member of your organization.')
  );
  const result = await request(app)
    .post('/auth/invitations/accept')
    .send({ token: 'invite' });
  expect(result.status).toBe(409);
  expect(result.body.error).toContain('your organization');
});

it('keeps inbox-verification instructions for new doulas', async () => {
  accept.mockResolvedValue({
    requiresEmailVerification: true,
    organizationName: 'Sokana 360',
  });
  const result = await request(app)
    .post('/auth/invitations/accept')
    .send({ token: 'invite', password: 'new-password' });
  expect(result.status).toBe(200);
  expect(result.body.message).toContain('verify your address');
});

it('exposes the existing-account preview flag for the invitation screen', async () => {
  preview.mockResolvedValue({
    email: 'doula@example.test',
    requiresSignIn: true,
    organizationName: 'Sokana 360',
  });
  const result = await request(app)
    .post('/auth/invitations/preview')
    .send({ token: 'invite' });
  expect(result.status).toBe(200);
  expect(result.body.requiresSignIn).toBe(true);
});
