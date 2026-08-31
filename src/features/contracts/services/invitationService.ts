import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { randomUUID } from 'crypto';

export interface ContractInvitationRecord {
  id: string;
  contractId: string;
  clientId: string;
  tokenHash: string | Buffer;
  expiresAt: Date;
  revokedAt: Date | null;
  completedAt?: Date | null;
  createdAt: Date;
}

export interface CreateInvitationInput {
  id: string;
  contractId: string;
  clientId: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface InvitationRepository {
  findById(id: string): Promise<ContractInvitationRecord | null>;
  create(input: CreateInvitationInput): Promise<ContractInvitationRecord>;
  /**
   * Revokes every active invitation for the contract and inserts `input` in
   * one database transaction.
   */
  replaceActive(
    contractId: string,
    input: CreateInvitationInput
  ): Promise<ContractInvitationRecord>;
  expireContractForInvitation?(invitationId: string): Promise<void>;
}

export interface InvitationContractLookup {
  id: string;
  clientId: string;
  status: string;
}

export interface InvitationContractRepository {
  findInvitationContract(
    contractId: string
  ): Promise<InvitationContractLookup | null>;
}

export interface IssuedInvitation {
  invitation: ContractInvitationRecord;
  token: string;
}

export class InvalidInvitationError extends Error {
  readonly statusCode = 404;

  constructor() {
    super('Invitation is invalid or unavailable');
  }
}

const ACTIVE_CONTRACT_STATUSES = new Set([
  'sent',
  'viewed',
  'partially_signed',
  'signed',
]);

export class InvitationService {
  constructor(
    private readonly invitations: InvitationRepository,
    private readonly contracts: InvitationContractRepository,
    private readonly ttlMs = 7 * 24 * 60 * 60 * 1000
  ) {}

  async issue(
    contractId: string,
    clientId: string,
    replace = false
  ): Promise<IssuedInvitation> {
    const prepared = this.prepare(contractId, clientId);
    const invitation = replace
      ? await this.invitations.replaceActive(contractId, prepared.input)
      : await this.invitations.create(prepared.input);
    return { invitation, token: prepared.token };
  }

  prepare(
    contractId: string,
    clientId: string
  ): {
    input: CreateInvitationInput;
    token: string;
  } {
    const id = randomUUID();
    // UUID is only the lookup key. The second component carries >=256 bits of
    // entropy and is the portion that makes an invitation unguessable.
    const token = `${id}.${randomBytes(32).toString('base64url')}`;
    const input: CreateInvitationInput = {
      id,
      contractId,
      clientId,
      tokenHash: this.hash(token).toString('hex'),
      expiresAt: new Date(Date.now() + this.ttlMs),
    };
    return { input, token };
  }

  /** Session-bound checks without the invitation secret. */
  async verifySessionInvitation(invitationId: string): Promise<{
    invitation: ContractInvitationRecord;
    contract: InvitationContractLookup;
  }> {
    const invitation = await this.invitations.findById(invitationId);
    if (!invitation || invitation.revokedAt) {
      throw new InvalidInvitationError();
    }
    if (invitation.expiresAt.getTime() <= Date.now()) {
      if (!invitation.completedAt) {
        await this.invitations.expireContractForInvitation?.(invitation.id);
      }
      throw new InvalidInvitationError();
    }
    const contract = await this.contracts.findInvitationContract(
      invitation.contractId
    );
    if (
      !contract ||
      contract.clientId !== invitation.clientId ||
      !ACTIVE_CONTRACT_STATUSES.has(contract.status)
    ) {
      throw new InvalidInvitationError();
    }
    return { invitation, contract };
  }

  async verify(token: string): Promise<{
    invitation: ContractInvitationRecord;
    contract: InvitationContractLookup;
    tokenFingerprint: string;
  }> {
    const invitationId = this.extractInvitationId(token);
    const invitation = await this.invitations.findById(invitationId);

    // Hash and compare only after the UUID lookup, while preserving a constant
    // time comparison for equal-length digests.
    const presentedHash = this.hash(token);
    const storedHash = invitation
      ? this.decodeHash(invitation.tokenHash)
      : Buffer.alloc(presentedHash.length);
    const hashMatches =
      storedHash.length === presentedHash.length &&
      timingSafeEqual(storedHash, presentedHash);

    if (!invitation || !hashMatches) throw new InvalidInvitationError();
    if (invitation.revokedAt) {
      throw new InvalidInvitationError();
    }
    if (invitation.expiresAt.getTime() <= Date.now()) {
      if (!invitation.completedAt) {
        await this.invitations.expireContractForInvitation?.(invitation.id);
      }
      throw new InvalidInvitationError();
    }

    const contract = await this.contracts.findInvitationContract(
      invitation.contractId
    );
    if (
      !contract ||
      contract.clientId !== invitation.clientId ||
      !ACTIVE_CONTRACT_STATUSES.has(contract.status)
    ) {
      throw new InvalidInvitationError();
    }

    return {
      invitation,
      contract,
      tokenFingerprint: presentedHash.toString('hex'),
    };
  }

  private extractInvitationId(token: string): string {
    if (typeof token !== 'string' || token.length > 512) {
      throw new InvalidInvitationError();
    }
    const separator = token.indexOf('.');
    const id = separator > 0 ? token.slice(0, separator) : '';
    const secret = separator > 0 ? token.slice(separator + 1) : '';
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        id
      ) ||
      Buffer.from(secret, 'base64url').length < 32
    ) {
      throw new InvalidInvitationError();
    }
    return id;
  }

  private hash(value: string): Buffer {
    return createHash('sha256').update(value, 'utf8').digest();
  }

  private decodeHash(value: string | Buffer): Buffer {
    if (Buffer.isBuffer(value)) return value;
    return /^[a-f0-9]{64}$/i.test(value)
      ? Buffer.from(value, 'hex')
      : Buffer.from(value, 'base64');
  }
}
