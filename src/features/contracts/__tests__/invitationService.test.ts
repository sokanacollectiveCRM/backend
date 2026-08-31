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

  it('rejects an expired active invitation and expires the unsigned contract', async () => {
    const expireContractForInvitation = jest.fn();
    repository.expireContractForInvitation = expireContractForInvitation;
    const service = new InvitationService(repository, contracts);
    const issued = await service.issue('contract-1', 'client-1');
    issued.invitation.expiresAt = new Date(Date.now() - 1);

    await expect(service.verify(issued.token)).rejects.toBeInstanceOf(
      InvalidInvitationError
    );
    expect(expireContractForInvitation).toHaveBeenCalledWith(
      issued.invitation.id
    );
  });

  it('rejects an expired completed invitation without expiring the signed contract', async () => {
    const expireContractForInvitation = jest.fn();
    repository.expireContractForInvitation = expireContractForInvitation;
    const service = new InvitationService(repository, contracts);
    const issued = await service.issue('contract-1', 'client-1');
    issued.invitation.completedAt = new Date();
    issued.invitation.expiresAt = new Date(Date.now() - 1);

    await expect(service.verify(issued.token)).rejects.toBeInstanceOf(
      InvalidInvitationError
    );
    expect(expireContractForInvitation).not.toHaveBeenCalled();
  });

  it('rejects an invitation at the exact expiration time', async () => {
    const service = new InvitationService(repository, contracts);
    const issued = await service.issue('contract-1', 'client-1');
    const expiresAt = new Date('2026-08-31T12:00:00.000Z');
    issued.invitation.expiresAt = expiresAt;
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(expiresAt.getTime());

    await expect(service.verify(issued.token)).rejects.toBeInstanceOf(
      InvalidInvitationError
    );
    nowSpy.mockRestore();
  });

  it('allows a completed invitation before expiration for confirmation retries', async () => {
    const service = new InvitationService(repository, contracts);
    const issued = await service.issue('contract-1', 'client-1');
    issued.invitation.completedAt = new Date();
    contracts.findInvitationContract.mockResolvedValue({
      id: 'contract-1',
      clientId: 'client-1',
      status: 'signed',
    });

    await expect(service.verify(issued.token)).resolves.toMatchObject({
      invitation: { id: issued.invitation.id },
      contract: { id: 'contract-1', status: 'signed' },
    });
  });
});
