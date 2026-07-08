import { ValidationError } from '../domains/errors';
import { PortalInviteService } from '../services/portalInviteService';
import { portalEligibilityService } from '../services/portalEligibilityService';

const sendPortalInviteEmail = jest.fn();

jest.mock('../services/emailService', () => ({
  NodemailerService: jest.fn().mockImplementation(() => ({
    sendPortalInviteEmail,
  })),
}));

jest.mock('../services/portalEligibilityService', () => ({
  portalEligibilityService: {
    getInviteEligibility: jest.fn(),
  },
}));

describe('PortalInviteService', () => {
  const clientId = 'client-1';
  const adminUserId = 'admin-1';
  const authUserId = 'auth-user-1';

  const clientRecord = {
    id: clientId,
    email: 'jane@example.com',
    first_name: 'Jane',
    last_name: 'Doe',
    portal_status: 'not_invited' as const,
    invited_at: null,
    last_invite_sent_at: null,
    invite_sent_count: 0,
    user_id: null,
  };

  const createSupabaseClient = () =>
    ({
      auth: {
        admin: {
          createUser: jest.fn().mockResolvedValue({
            data: { user: { id: authUserId } },
            error: null,
          }),
          generateLink: jest.fn().mockResolvedValue({
            data: { properties: { action_link: 'https://portal.example/set-password' } },
            error: null,
          }),
          listUsers: jest.fn().mockResolvedValue({
            data: { users: [] },
          }),
        },
      },
    }) as any;

  const createRepository = () => ({
    getClientById: jest.fn().mockResolvedValue(clientRecord),
    markInvited: jest.fn().mockResolvedValue({
      ...clientRecord,
      portal_status: 'invited',
      invited_at: new Date('2026-07-08T12:00:00.000Z'),
      last_invite_sent_at: new Date('2026-07-08T12:00:00.000Z'),
      invite_sent_count: 1,
      user_id: authUserId,
    }),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.FRONTEND_URL = 'https://portal.example/';
  });

  it('rejects blocked clients before auth or email providers are called', async () => {
    const supabaseClient = createSupabaseClient();
    const repository = createRepository();
    (portalEligibilityService.getInviteEligibility as jest.Mock).mockResolvedValue({
      eligible: false,
      reason: 'Client is not portal eligible: missing card on file.',
    });

    const service = new PortalInviteService(supabaseClient, repository as any);

    await expect(service.inviteClientToPortal(clientId, adminUserId)).rejects.toThrow(
      'Client is not portal eligible: missing card on file.'
    );

    expect(portalEligibilityService.getInviteEligibility).toHaveBeenCalledWith(clientId);
    expect(supabaseClient.auth.admin.createUser).not.toHaveBeenCalled();
    expect(supabaseClient.auth.admin.generateLink).not.toHaveBeenCalled();
    expect(sendPortalInviteEmail).not.toHaveBeenCalled();
    expect(repository.markInvited).not.toHaveBeenCalled();
  });

  it('sends an invite for eligible clients using server-side readiness', async () => {
    const supabaseClient = createSupabaseClient();
    const repository = createRepository();
    (portalEligibilityService.getInviteEligibility as jest.Mock).mockResolvedValue({
      eligible: true,
      snapshot: {
        is_eligible: true,
        primary_portal_blocker: null,
        allowed_actions: {
          can_invite_to_portal: true,
        },
      },
    });

    const service = new PortalInviteService(supabaseClient, repository as any);
    const result = await service.inviteClientToPortal(clientId, adminUserId);

    expect(portalEligibilityService.getInviteEligibility).toHaveBeenCalledWith(clientId);
    expect(supabaseClient.auth.admin.createUser).toHaveBeenCalledWith({
      email: 'jane@example.com',
      email_confirm: false,
      user_metadata: {
        client_id: clientId,
        role: 'client',
      },
    });
    expect(supabaseClient.auth.admin.generateLink).toHaveBeenCalledWith({
      type: 'recovery',
      email: 'jane@example.com',
      options: { redirectTo: 'https://portal.example/auth/set-password' },
    });
    expect(sendPortalInviteEmail).toHaveBeenCalledTimes(1);
    expect(sendPortalInviteEmail).toHaveBeenCalledWith(
      'jane@example.com',
      'Jane Doe',
      'https://portal.example/set-password'
    );
    expect(repository.markInvited).toHaveBeenCalledWith(clientId, authUserId);
    expect(result).toEqual(
      expect.objectContaining({
        clientId,
        portalStatus: 'invited',
        inviteSentCount: 1,
        invitedBy: adminUserId,
        authUserId,
      })
    );
  });

  it('rejects invites when the client has no email address', async () => {
    const supabaseClient = createSupabaseClient();
    const repository = createRepository();
    repository.getClientById.mockResolvedValue({
      ...clientRecord,
      email: null,
    });

    const service = new PortalInviteService(supabaseClient, repository as any);

    await expect(service.inviteClientToPortal(clientId, adminUserId)).rejects.toBeInstanceOf(
      ValidationError
    );

    expect(portalEligibilityService.getInviteEligibility).not.toHaveBeenCalled();
    expect(sendPortalInviteEmail).not.toHaveBeenCalled();
  });
});
