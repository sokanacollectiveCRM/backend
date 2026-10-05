import { randomUUID } from 'crypto';

import { SafeContractSignatureDto, SignatureKind } from '../domain/types';
import { ContractDbClient, queryWithClient } from './db';

export interface PersistContractSignatureRecord {
  id?: string;
  contractId: string;
  clientId: string;
  signerName: string;
  type: SignatureKind;
  typedRepresentation?: string | null;
  privateObjectPath?: string | null;
  initials: string;
  consentVersion: string;
  completedFieldIds: readonly string[];
}

interface SignatureRow {
  id: string;
  client_id: string;
  signature_type: SignatureKind;
  server_timestamp: Date;
}

export class SignatureRepository {
  async create(
    input: PersistContractSignatureRecord,
    client?: ContractDbClient
  ): Promise<SafeContractSignatureDto> {
    const { rows } = await queryWithClient<SignatureRow>(
      client,
      `INSERT INTO public.contract_signatures
       (id, contract_id, client_id, signature_type, typed_representation,
        private_object_path, adopted_initials, consent_version,
        completed_field_ids)
       SELECT $1::uuid, c.id, c.client_id, $4, $5, $6, $7, $8, $9::jsonb
       FROM public.phi_contracts c
       WHERE c.id = $2::uuid AND c.client_id = $3::uuid
       RETURNING id, client_id, signature_type, server_timestamp`,
      [
        input.id ?? randomUUID(),
        input.contractId,
        input.clientId,
        input.type,
        input.type === 'typed' ? input.typedRepresentation : null,
        input.type === 'drawn' ? input.privateObjectPath : null,
        input.initials,
        input.consentVersion,
        JSON.stringify(input.completedFieldIds),
      ]
    );
    if (!rows[0]) throw new Error('Contract not found for client');
    return {
      id: rows[0].id,
      signerId: rows[0].client_id,
      signerName: input.signerName,
      type: rows[0].signature_type,
      signedAt: rows[0].server_timestamp.toISOString(),
      completedFieldIds: [...input.completedFieldIds],
    };
  }

  async listForContract(
    contractId: string,
    clientId: string,
    client?: ContractDbClient
  ): Promise<SafeContractSignatureDto[]> {
    const { rows } = await queryWithClient<
      SignatureRow & {
        signer_name: string;
        completed_field_ids: string[];
      }
    >(
      client,
      `SELECT s.id, s.client_id, s.signature_type, s.server_timestamp,
              c.field_snapshot->'client'->>'name' AS signer_name,
              s.completed_field_ids
       FROM public.contract_signatures s
       JOIN public.phi_contracts c ON c.id = s.contract_id
       WHERE s.contract_id = $1::uuid AND c.client_id = $2::uuid
       ORDER BY s.server_timestamp, s.id`,
      [contractId, clientId]
    );
    return rows.map((row) => ({
      id: row.id,
      signerId: row.client_id,
      signerName: row.signer_name,
      type: row.signature_type,
      signedAt: row.server_timestamp.toISOString(),
      completedFieldIds: row.completed_field_ids,
    }));
  }
}

export const signatureRepository = new SignatureRepository();
export const cloudSqlSignatureRepository = signatureRepository;
