import {
  isClientDepositRequired,
  resolveBillingPath,
} from '../../../constants/portalEligibility';
import { ContractSignatureValue, ContractSnapshot } from '../domain/types';
import { signingManifestFromSnapshot } from '../services/signingManifest';
import {
  SignedCompletionResult,
  SigningContractRecord,
  SigningProgressRecord,
} from '../services/signingSessionService';
import {
  ContractDbClient,
  queryWithClient,
  withContractTransaction,
} from './db';
import { EventRepository } from './eventRepository';
import { OutboxRepository } from './outboxRepository';
import { SignatureRepository } from './signatureRepository';

interface SigningContractRow {
  id: string;
  client_id: string;
  status: string;
  template_identifier: string;
  template_version: number;
  field_snapshot: ContractSnapshot;
  unsigned_document_path: string;
  unsigned_document_hash: string;
  unsigned_document_generation: string | null;
}

interface InvitationProgressRow {
  progress: { fields?: Array<{ fieldId: string; completedAt: string }> };
}

function transaction(value: unknown): ContractDbClient {
  if (!value || typeof (value as ContractDbClient).query !== 'function') {
    throw new Error('A database transaction is required');
  }
  return value as ContractDbClient;
}

export class SigningSessionRepository {
  async getContract(contractId: string): Promise<SigningContractRecord | null> {
    const { rows } = await queryWithClient<SigningContractRow>(
      undefined,
      `SELECT c.id, c.client_id, c.status, c.template_identifier,
              c.template_version, c.field_snapshot,
              c.unsigned_document_path, c.unsigned_document_hash,
              c.unsigned_document_generation
       FROM public.phi_contracts c
       WHERE c.id = $1::uuid AND c.signing_provider = 'native'
       LIMIT 1`,
      [contractId]
    );
    const row = rows[0];
    return row
      ? {
          id: row.id,
          clientId: row.client_id,
          status: row.status,
          clientName: row.field_snapshot.client.name,
          serviceType: row.field_snapshot.serviceType,
          templateIdentifier: row.template_identifier,
          templateVersion: row.template_version,
          snapshot: row.field_snapshot,
          signingManifest: signingManifestFromSnapshot(row.field_snapshot),
          unsignedPdfObject: row.unsigned_document_path,
          unsignedPdfSha256: row.unsigned_document_hash,
          unsignedPdfGeneration: row.unsigned_document_generation,
        }
      : null;
  }

  async getProgress(
    invitationId: string
  ): Promise<readonly SigningProgressRecord[]> {
    const { rows } = await queryWithClient<InvitationProgressRow>(
      undefined,
      `SELECT progress FROM public.signing_invitations
       WHERE id = $1::uuid LIMIT 1`,
      [invitationId]
    );
    return (rows[0]?.progress?.fields ?? []).map((item) => ({
      fieldId: item.fieldId,
      completedAt: new Date(item.completedAt),
    }));
  }

  async recordFirstViewed(
    invitationId: string,
    contractId: string,
    viewedAt: Date,
    evidence?: import('../services/signingSessionService').RequestEvidence
  ): Promise<void> {
    await withContractTransaction(async (client) => {
      const { rows } = await client.query<{
        client_id: string;
        opened_at: Date | null;
      }>(
        `SELECT client_id, opened_at FROM public.signing_invitations
         WHERE id = $1::uuid AND contract_id = $2::uuid FOR UPDATE`,
        [invitationId, contractId]
      );
      const row = rows[0];
      if (!row || row.opened_at) return;
      await client.query(
        `UPDATE public.signing_invitations
         SET opened_at = $3, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1::uuid AND contract_id = $2::uuid`,
        [invitationId, contractId, viewedAt]
      );
      await client.query(
        `UPDATE public.phi_contracts
         SET status = CASE WHEN status = 'sent' THEN 'viewed' ELSE status END,
             viewed_at = COALESCE(viewed_at, $2), updated_at = CURRENT_TIMESTAMP
         WHERE id = $1::uuid`,
        [contractId, viewedAt]
      );
      await new EventRepository().append(
        {
          contractId,
          clientId: row.client_id,
          eventType: 'contract_opened',
          actorType: 'client',
          correlationId: evidence?.correlationId ?? undefined,
          ipAddress: evidence?.ipAddress,
          userAgent: evidence?.userAgent,
        },
        client
      );
    });
  }

  async saveProgress(
    invitationId: string,
    contractId: string,
    completedFields: readonly SigningProgressRecord[],
    _evidence?: import('../services/signingSessionService').RequestEvidence
  ): Promise<readonly SigningProgressRecord[]> {
    const progress = {
      fields: completedFields.map((field) => ({
        fieldId: field.fieldId,
        completedAt: field.completedAt.toISOString(),
      })),
    };
    return withContractTransaction(async (client) => {
      const { rows } = await queryWithClient<InvitationProgressRow>(
        client,
        `UPDATE public.signing_invitations
         SET progress = $3::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1::uuid AND contract_id = $2::uuid
           AND revoked_at IS NULL AND completed_at IS NULL
           AND expires_at > CURRENT_TIMESTAMP
         RETURNING progress`,
        [invitationId, contractId, JSON.stringify(progress)]
      );
      if (!rows[0]) throw new Error('Signing invitation is unavailable');
      if (completedFields.length > 0) {
        await client.query(
          `UPDATE public.phi_contracts
           SET status = CASE
                 WHEN status IN ('sent', 'viewed') THEN 'partially_signed'
                 ELSE status
               END,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1::uuid`,
          [contractId]
        );
      }
      return completedFields;
    });
  }

  async withCompletionLock<T>(
    invitationId: string,
    work: (transaction: unknown) => Promise<T>
  ): Promise<T> {
    return withContractTransaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `contract-completion:${invitationId}`,
      ]);
      const result = await client.query(
        `SELECT id FROM public.signing_invitations
         WHERE id = $1::uuid FOR UPDATE`,
        [invitationId]
      );
      if (!result.rows[0]) throw new Error('Signing invitation is unavailable');
      return work(client);
    });
  }

  async findSignedResult(
    contractId: string,
    transactionValue: unknown
  ): Promise<SignedCompletionResult | null> {
    const client = transaction(transactionValue);
    const { rows } = await queryWithClient<{
      contract_id: string;
      client_id: string;
      signer_name: string;
      signature_id: string;
      signature_type: 'typed' | 'drawn';
      signed_at: Date;
      field_ids: string[];
    }>(
      client,
      `SELECT c.id AS contract_id, c.client_id,
              c.field_snapshot->'client'->>'name' AS signer_name,
              s.id AS signature_id, s.signature_type,
              s.server_timestamp AS signed_at,
              s.completed_field_ids AS field_ids
       FROM public.phi_contracts c
       JOIN public.contract_signatures s ON s.contract_id = c.id
       WHERE c.id = $1::uuid AND c.status = 'signed'
       LIMIT 1`,
      [contractId]
    );
    const row = rows[0];
    return row
      ? {
          contractId: row.contract_id,
          status: 'signed',
          signedAt: row.signed_at.toISOString(),
          signature: {
            id: row.signature_id,
            signerId: row.client_id,
            signerName: row.signer_name,
            type: row.signature_type,
            signedAt: row.signed_at.toISOString(),
            completedFieldIds: row.field_ids,
          },
        }
      : null;
  }

  async getContractForCompletion(
    invitationId: string,
    transactionValue: unknown
  ): Promise<SigningContractRecord | null> {
    const client = transaction(transactionValue);
    const { rows } = await queryWithClient<SigningContractRow>(
      client,
      `SELECT c.id, c.client_id, c.status, c.template_identifier,
              c.template_version, c.field_snapshot,
              c.unsigned_document_path, c.unsigned_document_hash,
              c.unsigned_document_generation
       FROM public.phi_contracts c
       JOIN public.signing_invitations i
         ON i.contract_id = c.id AND i.client_id = c.client_id
       WHERE i.id = $1::uuid
         AND i.revoked_at IS NULL AND i.completed_at IS NULL
         AND i.expires_at > CURRENT_TIMESTAMP
         AND c.signing_provider = 'native'
       FOR UPDATE OF c, i`,
      [invitationId]
    );
    const row = rows[0];
    return row
      ? {
          id: row.id,
          clientId: row.client_id,
          status: row.status,
          clientName: row.field_snapshot.client.name,
          serviceType: row.field_snapshot.serviceType,
          templateIdentifier: row.template_identifier,
          templateVersion: row.template_version,
          snapshot: row.field_snapshot,
          signingManifest: signingManifestFromSnapshot(row.field_snapshot),
          unsignedPdfObject: row.unsigned_document_path,
          unsignedPdfSha256: row.unsigned_document_hash,
          unsignedPdfGeneration: row.unsigned_document_generation,
        }
      : null;
  }

  async finalizeCompletion(
    input: {
      invitationId: string;
      contractId: string;
      signature: ContractSignatureValue;
      signerName: string;
      initials: string;
      completedFieldIds: readonly string[];
      consentedAt: Date;
      signedAt: Date;
      signedPdfObject: string;
      signedPdfSha256: string;
      signedPdfGeneration: string | null;
      signatureObjectPath: string | null;
      evidence?: import('../services/signingSessionService').RequestEvidence;
    },
    transactionValue: unknown
  ): Promise<SignedCompletionResult> {
    const client = transaction(transactionValue);
    const { rows } = await queryWithClient<{
      client_id: string;
      field_snapshot: ContractSnapshot;
      payment_method: string | null;
    }>(
      client,
      `SELECT c.client_id, c.field_snapshot, pc.payment_method
       FROM public.phi_contracts c
       JOIN public.signing_invitations i ON i.contract_id = c.id
       JOIN public.phi_clients pc ON pc.id = c.client_id
       WHERE c.id = $1::uuid AND i.id = $2::uuid
         AND i.client_id = c.client_id
       FOR UPDATE OF c, i`,
      [input.contractId, input.invitationId]
    );
    const contract = rows[0];
    if (!contract) throw new Error('Signing invitation is unavailable');

    const signature = await new SignatureRepository().create(
      {
        contractId: input.contractId,
        clientId: contract.client_id,
        signerName: input.signerName,
        type: input.signature.type,
        typedRepresentation:
          input.signature.type === 'typed' ? input.signature.text : null,
        privateObjectPath:
          input.signature.type === 'drawn' ? input.signatureObjectPath : null,
        initials: input.initials,
        consentVersion: 'native-contract-consent-v1',
        completedFieldIds: input.completedFieldIds,
      },
      client
    );
    await client.query(
      `UPDATE public.phi_contracts
       SET status = 'signed', consented_at = $2, signed_at = $3,
           signed_document_path = $4, signed_document_hash = $5,
           signed_document_generation = $6,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1::uuid`,
      [
        input.contractId,
        input.consentedAt,
        input.signedAt,
        input.signedPdfObject,
        input.signedPdfSha256,
        input.signedPdfGeneration,
      ]
    );
    await client.query(
      `UPDATE public.signing_invitations
       SET completed_at = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1::uuid`,
      [input.invitationId, input.signedAt]
    );
    await client.query(
      `UPDATE public.signing_invitations
       SET revoked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE contract_id = $1::uuid AND id <> $2::uuid
         AND revoked_at IS NULL AND completed_at IS NULL`,
      [input.contractId, input.invitationId]
    );
    const events = new EventRepository();
    for (const eventType of [
      'consent_accepted',
      'initials_adopted',
      'signature_adopted',
      'contract_signed',
    ]) {
      await events.append(
        {
          contractId: input.contractId,
          clientId: contract.client_id,
          eventType,
          actorType: 'client',
          correlationId: input.evidence?.correlationId ?? undefined,
          payload:
            eventType === 'contract_signed'
              ? { completedFieldIds: input.completedFieldIds }
              : {},
          ipAddress: input.evidence?.ipAddress,
          userAgent: input.evidence?.userAgent,
        },
        client
      );
    }

    const payload = {
      contractId: input.contractId,
      clientId: contract.client_id,
      clientName: contract.field_snapshot.client.name,
      clientEmail: contract.field_snapshot.client.email,
      serviceType: contract.field_snapshot.serviceType,
      totalCents: contract.field_snapshot.pricing.totalCents,
      depositCents: contract.field_snapshot.pricing.depositCents,
      installmentCount: contract.field_snapshot.pricing.installmentCents.length,
      signedAt: input.signedAt.toISOString(),
    };
    const outbox = new OutboxRepository();
    const outboxTypes = [
      'signed_copy_email',
      'admin_contract_signed_notification',
      'portal_eligibility',
      ...(isClientDepositRequired(resolveBillingPath(contract.payment_method))
        ? (['quickbooks_deposit_invoice'] as const)
        : []),
      'client_portal_notification',
    ] as const;
    for (const type of outboxTypes) {
      await outbox.enqueue(
        {
          contractId: input.contractId,
          clientId: contract.client_id,
          type,
          idempotencyKey: `contract:${input.contractId}:signed:${type}`,
          payload,
        },
        client
      );
    }
    return {
      contractId: input.contractId,
      status: 'signed',
      signature,
      signedAt: input.signedAt.toISOString(),
    };
  }
}

export const signingSessionRepository = new SigningSessionRepository();
export const cloudSqlSigningSessionRepository = signingSessionRepository;
