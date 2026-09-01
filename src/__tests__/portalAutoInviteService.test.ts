import {
  SYSTEM_PORTAL_INVITE_ACTOR,
  tryAutoPortalInvite,
} from '../services/portalAutoInviteService';
import { portalEligibilityService } from '../services/portalEligibilityService';
import { PortalInviteService } from '../services/portalInviteService';

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

jest.mock('../supabase', () => ({
  getSupabaseAdmin: jest.fn(),
}));

jest.mock('../repositories/cloudSqlPortalRepository', () => ({
  CloudSqlPortalRepository: jest.fn(),
}));

jest.mock(
  '../repositories/cloudSqlClientOnboardingReadinessRepository',
  () => ({
    clientOnboardingReadinessRepository: {
      recordEvent: jest.fn().mockResolvedValue(undefined),
    },
  })
);

describe('portalAutoInviteService', () => {
  const clientId = 'client-1';
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
            data: {
              properties: {
                action_link: 'https://portal.example/set-password',
              },
            },
            error: null,
          }),
          listUsers: jest.fn().mockResolvedValue({ data: { users: [] } }),
        },
      },
    }) as any;

  const createRepository = () => ({
    getClientById: jest.fn().mockResolvedValue(clientRecord),
    markInvited: jest.fn().mockResolvedValue({
      ...clientRecord,
      portal_status: 'invited',
      user_id: authUserId,
    }),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.PORTAL_AUTO_INVITE_ENABLED;
    process.env.FRONTEND_URL = 'https://portal.example/';
    const { getSupabaseAdmin } = require('../supabase');
    getSupabaseAdmin.mockReturnValue(createSupabaseClient());
  });

  it('sends an invite when the client becomes portal eligible', async () => {
    const repository = createRepository();
    const {
      CloudSqlPortalRepository,
    } = require('../repositories/cloudSqlPortalRepository');
    CloudSqlPortalRepository.mockImplementation(() => repository);
    (
      portalEligibilityService.getInviteEligibility as jest.Mock
    ).mockResolvedValue({
      eligible: true,
    });

    const result = await tryAutoPortalInvite(clientId, {
      eventSource: 'contract_outbox',
    });

    expect(result).toEqual({ sent: true });
    expect(portalEligibilityService.getInviteEligibility).toHaveBeenCalledWith(
      clientId
    );
    expect(sendPortalInviteEmail).toHaveBeenCalledTimes(1);
    expect(repository.markInvited).toHaveBeenCalledWith(clientId, authUserId);
  });

  it('does not invite when payment or billing readiness is still blocking', async () => {
    const repository = createRepository();
    const {
      CloudSqlPortalRepository,
    } = require('../repositories/cloudSqlPortalRepository');
    CloudSqlPortalRepository.mockImplementation(() => repository);
    (
      portalEligibilityService.getInviteEligibility as jest.Mock
    ).mockResolvedValue({
      eligible: false,
      reason: 'Invite available after contract is signed and deposit is paid.',
    });

    const result = await tryAutoPortalInvite(clientId);

    expect(result.sent).toBe(false);
    expect(result.reason).toContain('deposit is paid');
    expect(sendPortalInviteEmail).not.toHaveBeenCalled();
    expect(repository.markInvited).not.toHaveBeenCalled();
  });

  it('does not invite clients who were already invited', async () => {
    const repository = createRepository();
    repository.getClientById.mockResolvedValue({
      ...clientRecord,
      portal_status: 'invited',
    });
    const {
      CloudSqlPortalRepository,
    } = require('../repositories/cloudSqlPortalRepository');
    CloudSqlPortalRepository.mockImplementation(() => repository);

    const result = await tryAutoPortalInvite(clientId);

    expect(result).toEqual({
      sent: false,
      reason: 'already_invited_or_active',
    });
    expect(
      portalEligibilityService.getInviteEligibility
    ).not.toHaveBeenCalled();
    expect(sendPortalInviteEmail).not.toHaveBeenCalled();
  });

  it('uses the system actor id for automated invites', async () => {
    const repository = createRepository();
    const {
      CloudSqlPortalRepository,
    } = require('../repositories/cloudSqlPortalRepository');
    CloudSqlPortalRepository.mockImplementation(() => repository);
    (
      portalEligibilityService.getInviteEligibility as jest.Mock
    ).mockResolvedValue({
      eligible: true,
    });

    const inviteSpy = jest
      .spyOn(PortalInviteService.prototype, 'inviteClientToPortal')
      .mockResolvedValue({
        clientId,
        portalStatus: 'invited',
        invitedAt: new Date(),
        lastInviteSentAt: new Date(),
        inviteSentCount: 1,
        invitedBy: SYSTEM_PORTAL_INVITE_ACTOR,
        authUserId,
      });

    await tryAutoPortalInvite(clientId);

    expect(inviteSpy).toHaveBeenCalledWith(
      clientId,
      SYSTEM_PORTAL_INVITE_ACTOR
    );
    inviteSpy.mockRestore();
  });
});
