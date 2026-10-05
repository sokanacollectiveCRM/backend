import { createHash } from 'crypto';

import {
  ContractDbClient,
  queryWithClient,
  withContractTransaction,
} from './db';

export interface SigningAccessSessionRecord {
  id: string;
  invitationId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

interface AccessSessionRow {
  id: string;
  invitation_id: string;
  expires_at: Date;
  revoked_at: Date | null;
  created_at: Date;
}

const toRecord = (row: AccessSessionRow): SigningAccessSessionRecord => ({
  id: row.id,
  invitationId: row.invitation_id,
  expiresAt: row.expires_at,
  revokedAt: row.revoked_at,
  createdAt: row.created_at,
});

export function hashSigningAccessToken(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

export class SigningAccessSessionRepository {
  async create(
    input: {
      id: string;
      invitationId: string;
      tokenHash: string;
      expiresAt: Date;
    },
    client?: ContractDbClient
  ): Promise<SigningAccessSessionRecord> {
    const { rows } = await queryWithClient<AccessSessionRow>(
      client,
      `INSERT INTO public.signing_access_sessions
       (id, invitation_id, token_hash, expires_at)
       SELECT $1::uuid, i.id, decode($3, 'hex'), $4
       FROM public.signing_invitations i
       WHERE i.id = $2::uuid
       RETURNING id, invitation_id, expires_at, revoked_at, created_at`,
      [input.id, input.invitationId, input.tokenHash, input.expiresAt]
    );
    if (!rows[0]) throw new Error('Signing invitation is unavailable');
    return toRecord(rows[0]);
  }

  async findById(
    id: string,
    client?: ContractDbClient
  ): Promise<(SigningAccessSessionRecord & { tokenHash: Buffer }) | null> {
    const { rows } = await queryWithClient<
      AccessSessionRow & { token_hash: Buffer }
    >(
      client,
      `SELECT id, invitation_id, token_hash, expires_at, revoked_at, created_at
       FROM public.signing_access_sessions
       WHERE id = $1::uuid
       LIMIT 1`,
      [id]
    );
    const row = rows[0];
    return row
      ? {
          ...toRecord(row),
          tokenHash: row.token_hash,
        }
      : null;
  }

  async touchLastUsed(id: string, client?: ContractDbClient): Promise<void> {
    await queryWithClient(
      client,
      `UPDATE public.signing_access_sessions
       SET last_used_at = CURRENT_TIMESTAMP
       WHERE id = $1::uuid`,
      [id]
    );
  }

  async revokeForInvitation(
    invitationId: string,
    client?: ContractDbClient
  ): Promise<void> {
    await queryWithClient(
      client,
      `UPDATE public.signing_access_sessions
       SET revoked_at = CURRENT_TIMESTAMP
       WHERE invitation_id = $1::uuid
         AND revoked_at IS NULL`,
      [invitationId]
    );
  }

  async revokeAllForContract(
    contractId: string,
    client?: ContractDbClient
  ): Promise<void> {
    await queryWithClient(
      client,
      `UPDATE public.signing_access_sessions s
       SET revoked_at = CURRENT_TIMESTAMP
       FROM public.signing_invitations i
       WHERE s.invitation_id = i.id
         AND i.contract_id = $1::uuid
         AND s.revoked_at IS NULL`,
      [contractId]
    );
  }

  async revokeAllForContractInTransaction(
    contractId: string,
    client: ContractDbClient
  ): Promise<void> {
    await this.revokeAllForContract(contractId, client);
  }
}

export const signingAccessSessionRepository =
  new SigningAccessSessionRepository();
