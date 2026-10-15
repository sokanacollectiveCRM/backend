import { getPool } from '../db/cloudSqlPool';
import { User } from '../entities/User';
import { acceptStaffInvitation } from '../features/team/application/staffInvitationService';
import { isCurrentAccountActive } from '../security/accountAccess';
import { CloudSqlTeamService } from '../services/cloudSqlTeamService';
import { getFirebaseAuth } from '../services/identityPlatform/firebaseAdmin';
import { ACCOUNT_STATUS, ROLE } from '../types';

jest.mock('../db/cloudSqlPool', () => ({ getPool: jest.fn() }));
jest.mock('../services/emailService', () => ({ NodemailerService: jest.fn() }));
jest.mock('../services/identityPlatform/firebaseAdmin', () => ({
  getFirebaseAuth: jest.fn(),
}));
jest.mock('../services/identityPlatform/emailVerificationService', () => ({
  emailVerificationService: { sendVerificationEmailForUid: jest.fn() },
}));

const query = jest.fn();
beforeEach(() => {
  query.mockReset();
  (getPool as jest.Mock).mockReturnValue({ query });
});

it('creates a pending doula through the current Team creation flow', async () => {
  query.mockResolvedValue({
    rows: [
      {
        id: 'doula',
        full_name: 'Maya Rivers',
        email: 'maya@example.com',
        account_status: 'pending',
      },
    ],
  });
  const result = await new CloudSqlTeamService().addDoula({
    firstname: 'Maya',
    lastname: 'Rivers',
    email: 'maya@example.com',
  });
  expect(query.mock.calls[0][0]).toContain("$4, 'pending', NULL");
  expect(result.account_status).toBe('pending');
});

it('creates a pending doula when accepting a token invitation', async () => {
  query.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM public.staff_invitations i'))
      return {
        rows: [
          {
            id: 'invite',
            tenant_id: 'tenant',
            email: 'maya@example.com',
            first_name: 'Maya',
            last_name: 'Rivers',
            role: 'doula',
            status: 'pending',
            expires_at: new Date(Date.now() + 60000),
          },
        ],
      };
    if (sql.includes('INSERT INTO public.doulas'))
      return { rows: [{ id: 'doula' }] };
    return { rows: [] };
  });
  (getFirebaseAuth as jest.Mock).mockReturnValue({
    createUser: jest.fn().mockResolvedValue({ uid: 'fictional' }),
    deleteUser: jest.fn(),
  });
  await acceptStaffInvitation({
    token: 'fictional-token',
    password: 'fictional-password',
  });
  const insert = query.mock.calls.find(([sql]) =>
    sql.includes('INSERT INTO public.doulas')
  );
  expect(insert?.[0]).toContain("NULL, 'pending', $3");
});

it('keeps pending doula accounts able to authenticate for onboarding', async () => {
  const doula = new User({
    id: 'doula',
    firstname: 'Maya',
    lastname: 'Rivers',
    email: 'maya@example.com',
    role: ROLE.DOULA,
    account_status: ACCOUNT_STATUS.PENDING,
  });
  await expect(isCurrentAccountActive(doula)).resolves.toBe(true);
  expect(query).not.toHaveBeenCalled();
});
