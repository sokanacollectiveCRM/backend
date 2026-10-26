import { getPool } from '../db/cloudSqlPool';
import { EmailController } from '../features/email/http/emailController';
import { NodemailerService } from '../services/emailService';

jest.mock('../db/cloudSqlPool', () => ({ getPool: jest.fn() }));
jest.mock('../services/emailService', () => ({ NodemailerService: jest.fn() }));
it('does not send a password-reset setup email after an existing-account organization invitation', async () => {
  const sendTeamInviteEmail = jest.fn();
  (NodemailerService as jest.Mock).mockImplementation(() => ({
    sendTeamInviteEmail,
  }));
  const query = jest.fn().mockResolvedValue({ rowCount: 1 });
  (getPool as jest.Mock).mockReturnValue({ query });
  const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  await new EmailController().sendTeamInvite(
    {
      tenant: { id: 'org-b' },
      body: {
        email: 'doula@example.test',
        firstname: 'Fixture',
        lastname: 'Doula',
        role: 'doula',
      },
    } as never,
    res
  );
  expect(query).toHaveBeenCalledWith(
    expect.stringContaining('tenant_id=$1::uuid'),
    ['org-b', 'doula@example.test']
  );
  expect(sendTeamInviteEmail).not.toHaveBeenCalled();
  expect(res.status).toHaveBeenCalledWith(200);
});
