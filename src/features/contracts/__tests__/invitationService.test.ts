import {
  ContractInvitationRecord,
  InvalidInvitationError,
  InvitationRepository,
  InvitationService,
} from '../services/invitationService';

describe('InvitationService', () => {
  const contracts = {
    findInvitationContract: jest.fn(),
  };
  let rows: Map<string, ContractInvitationRecord>;
  let repository: InvitationRepository;

  beforeEach(() => {
    rows = new Map();
    repository = {
      findById: jest.fn(async (id) => rows.get(id) ?? null),
      create: jest.fn(async (input) => {
        const row: ContractInvitationRecord = {
          ...input,
          revokedAt: null,
          createdAt: new Date(),
        };
        rows.set(row.id, row);
        return row;
      }),
      replaceActive: jest.fn(async (_contractId, input) => {
        for (const row of rows.values()) row.revokedAt = new Date();
        const replacement: ContractInvitationRecord = {
          ...input,
          revokedAt: null,
          createdAt: new Date(),
        };
        rows.set(replacement.id, replacement);
        return replacement;
      }),
    };
    contracts.findInvitationContract.mockResolvedValue({
      id: 'contract-1',
      clientId: 'client-1',
      status: 'sent',
    });
  });

  it('stores only a hash and verifies the UUID plus secret token', async () => {
    const service = new InvitationService(repository, contracts);
    const issued = await service.issue('contract-1', 'client-1');
    const [, secret] = issued.token.split('.');

    expect(Buffer.from(secret, 'base64url')).toHaveLength(32);
    expect(issued.invitation.tokenHash).not.toContain(issued.token);
    await expect(service.verify(issued.token)).resolves.toMatchObject({
      invitation: { id: issued.invitation.id },
      contract: { id: 'contract-1' },
    });
  });

  it('rejects a modified secret, revoked invitation, and ownership drift', async () => {
    const service = new InvitationService(repository, contracts);
    const issued = await service.issue('contract-1', 'client-1');
    await expect(
      service.verify(`${issued.invitation.id}.${'A'.repeat(43)}`)
    ).rejects.toBeInstanceOf(InvalidInvitationError);

    issued.invitation.revokedAt = new Date();
    await expect(service.verify(issued.token)).rejects.toBeInstanceOf(
      InvalidInvitationError
    );

    issued.invitation.revokedAt = null;
    contracts.findInvitationContract.mockResolvedValue({
      id: 'contract-1',
      clientId: 'different-client',
      status: 'sent',
    });
    await expect(service.verify(issued.token)).rejects.toBeInstanceOf(
      InvalidInvitationError
    );
  });

  it('uses the repository atomic replacement operation for resend', async () => {
    const service = new InvitationService(repository, contracts);
    const first = await service.issue('contract-1', 'client-1');
    const second = await service.issue('contract-1', 'client-1', true);

    expect(repository.replaceActive).toHaveBeenCalledTimes(1);
    expect(first.invitation.revokedAt).not.toBeNull();
    expect(second.invitation.revokedAt).toBeNull();
  });

  it('rejects an expired active invitation', async () => {
    const service = new InvitationService(repository, contracts);
    const issued = await service.issue('contract-1', 'client-1');
    issued.invitation.expiresAt = new Date(Date.now() - 1);

    await expect(service.verify(issued.token)).rejects.toBeInstanceOf(
      InvalidInvitationError
    );
  });
});
