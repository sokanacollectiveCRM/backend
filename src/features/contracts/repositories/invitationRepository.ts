import {
  ContractInvitationRecord,
  CreateInvitationInput,
} from '../services/invitationService';
import {
  ContractDbClient,
  queryWithClient,
  withContractTransaction,
} from './db';
import { EventRepository } from './eventRepository';

interface InvitationRow {
  id: string;
  contract_id: string;
  client_id: string;
  token_hash: Buffer;
  expires_at: Date;
  revoked_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
}

const SELECT = `SELECT id, contract_id, client_id, token_hash, expires_at,
                       revoked_at, completed_at, created_at
                FROM public.signing_invitations`;

const toRecord = (row: InvitationRow): ContractInvitationRecord => ({
  id: row.id,
  contractId: row.contract_id,
  clientId: row.client_id,
  tokenHash: row.token_hash,
  expiresAt: row.expires_at,
  revokedAt: row.revoked_at,
  completedAt: row.completed_at,
  createdAt: row.created_at,
});

export class InvitationRepository {
  async findById(
    id: string,
    client?: ContractDbClient
  ): Promise<ContractInvitationRecord | null> {
    const { rows } = await queryWithClient<InvitationRow>(
      client,
      `${SELECT} WHERE id = $1::uuid LIMIT 1`,
      [id]
    );
    return rows[0] ? toRecord(rows[0]) : null;
  }

  async create(
    input: CreateInvitationInput,
    client?: ContractDbClient
  ): Promise<ContractInvitationRecord> {
    const { rows } = await queryWithClient<InvitationRow>(
      client,
      `INSERT INTO public.signing_invitations
       (id, contract_id, client_id, token_hash, expires_at)
       SELECT $1::uuid, c.id, c.client_id, decode($4, 'hex'), $5
       FROM public.phi_contracts c
       WHERE c.id = $2::uuid AND c.client_id = $3::uuid
       RETURNING id, contract_id, client_id, token_hash, expires_at,
                 revoked_at, completed_at, created_at`,
      [
        input.id,
        input.contractId,
        input.clientId,
        input.tokenHash,
        input.expiresAt,
      ]
    );
    if (!rows[0]) throw new Error('Contract not found for client');
    return toRecord(rows[0]);
  }

  async replaceActive(
    contractId: string,
    input: CreateInvitationInput
  ): Promise<ContractInvitationRecord> {
    return withContractTransaction(async (client) => {
      await client.query(
        `SELECT id FROM public.phi_contracts WHERE id = $1::uuid FOR UPDATE`,
        [contractId]
      );
      await client.query(
        `UPDATE public.signing_invitations
         SET revoked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE contract_id = $1::uuid
           AND revoked_at IS NULL
           AND completed_at IS NULL`,
        [contractId]
      );
      return this.create(input, client);
    });
  }

  async getActiveByIdForUpdate(
    id: string,
    client: ContractDbClient
  ): Promise<ContractInvitationRecord | null> {
    const { rows } = await queryWithClient<InvitationRow>(
      client,
      `${SELECT}
       WHERE id = $1::uuid
         AND revoked_at IS NULL
         AND completed_at IS NULL
         AND expires_at > CURRENT_TIMESTAMP
       LIMIT 1 FOR UPDATE`,
      [id]
    );
    return rows[0] ? toRecord(rows[0]) : null;
  }

  async expireContractForInvitation(invitationId: string): Promise<void> {
    await withContractTransaction(async (client) => {
      const { rows } = await client.query<{
        contract_id: string;
        client_id: string;
        expires_at: Date;
        status: string;
      }>(
        `SELECT i.contract_id, i.client_id, i.expires_at, c.status
         FROM public.signing_invitations i
         JOIN public.phi_contracts c
           ON c.id = i.contract_id AND c.client_id = i.client_id
         WHERE i.id = $1::uuid
         FOR UPDATE OF i, c`,
        [invitationId]
      );
      const row = rows[0];
      if (
        !row ||
        row.expires_at.getTime() > Date.now() ||
        !['sent', 'viewed', 'partially_signed'].includes(row.status)
      ) {
        return;
      }
      const active = await client.query(
        `SELECT 1
         FROM public.signing_invitations
         WHERE contract_id = $1::uuid
           AND id <> $2::uuid
           AND revoked_at IS NULL
           AND completed_at IS NULL
           AND expires_at > CURRENT_TIMESTAMP
         LIMIT 1`,
        [row.contract_id, invitationId]
      );
      if (active.rows[0]) return;
      await client.query(
        `UPDATE public.phi_contracts
         SET status = 'expired', expired_at = COALESCE(expired_at, CURRENT_TIMESTAMP)
         WHERE id = $1::uuid`,
        [row.contract_id]
      );
      await new EventRepository().append(
        {
          contractId: row.contract_id,
          clientId: row.client_id,
          eventType: 'contract_expired',
          actorType: 'system',
        },
        client
      );
    });
  }
}

export const invitationRepository = new InvitationRepository();
export const cloudSqlInvitationRepository = invitationRepository;
