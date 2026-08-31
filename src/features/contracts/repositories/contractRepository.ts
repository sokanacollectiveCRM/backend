import { randomUUID } from 'crypto';

import {
  ContractSnapshot,
  ContractStatus,
  SafeContractDto,
  SafeContractSignatureDto,
} from '../domain/types';
import type {
  ContractAuditEvent,
  ContractEntity,
} from '../services/contractService';
import type { CreateInvitationInput } from '../services/invitationService';
import {
  ContractDbClient,
  queryWithClient,
  withContractTransaction,
} from './db';
import { EventRepository } from './eventRepository';
import { InvitationRepository } from './invitationRepository';
import { OutboxRepository } from './outboxRepository';

interface ContractRow {
  id: string;
  client_id: string;
  status: ContractStatus;
  template_identifier: string;
  field_snapshot: ContractSnapshot;
  created_at: Date | string;
  updated_at: Date | string;
  signatures?: SafeContractSignatureDto[] | null;
}

export interface CreateContractRecord {
  id: string;
  clientId: string;
  templateId: string;
  serviceType: string;
  status?: ContractStatus;
  snapshot: ContractSnapshot;
}

export interface ContractCompletionRecord {
  id: string;
  clientId: string;
  status: ContractStatus;
  snapshot: ContractSnapshot;
}

const SAFE_CONTRACT_SELECT = `
  SELECT
    c.id,
    c.client_id,
    c.status,
    c.template_identifier,
    c.field_snapshot,
    c.created_at,
    c.updated_at,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id,
        'signerId', s.client_id,
        'signerName', c.field_snapshot->'client'->>'name',
        'type', s.signature_type,
        'signedAt', s.server_timestamp,
        'completedFieldIds', s.completed_field_ids
      ) ORDER BY s.server_timestamp, s.id)
      FROM public.contract_signatures s
      WHERE s.contract_id = c.id
    ), '[]'::jsonb) AS signatures
  FROM public.phi_contracts c`;

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function toSafeDto(row: ContractRow): SafeContractDto {
  return {
    id: row.id,
    contractId: row.id,
    status: row.status,
    templateId: row.template_identifier,
    serviceType: row.field_snapshot.serviceType,
    clientName: row.field_snapshot.client.name,
    fields: row.field_snapshot.fields,
    selectedServices: row.field_snapshot.selectedServices,
    pricing: row.field_snapshot.pricing,
    signatures: row.signatures ?? [],
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    totalAmount: row.field_snapshot.pricing.totalCents,
    depositAmount: row.field_snapshot.pricing.depositCents,
    signedAt: row.signatures?.[0]?.signedAt,
  };
}

interface EntityRow {
  id: string;
  client_id: string;
  status: ContractStatus;
  field_snapshot: ContractSnapshot;
  unsigned_document_path: string | null;
  unsigned_document_hash: string | null;
  unsigned_document_generation: string | null;
  signed_document_path: string | null;
  created_at: Date;
  updated_at: Date;
  signatures: SafeContractSignatureDto[];
}

const ENTITY_SELECT = `
  SELECT c.id, c.client_id, c.status, c.field_snapshot,
         c.unsigned_document_path, c.unsigned_document_hash,
         c.unsigned_document_generation::text,
         c.signed_document_path, c.created_at, c.updated_at,
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
             'id', s.id,
             'signerId', s.client_id,
             'signerName', c.field_snapshot->'client'->>'name',
             'type', s.signature_type,
             'signedAt', s.server_timestamp,
             'completedFieldIds', s.completed_field_ids
           ) ORDER BY s.server_timestamp, s.id)
           FROM public.contract_signatures s
           WHERE s.contract_id = c.id
         ), '[]'::jsonb) AS signatures
  FROM public.phi_contracts c`;

const toEntity = (row: EntityRow): ContractEntity => ({
  id: row.id,
  clientId: row.client_id,
  status: row.status,
  snapshot: row.field_snapshot,
  signatures: row.signatures,
  unsignedPdfObject: row.unsigned_document_path,
  unsignedPdfSha256: row.unsigned_document_hash,
  unsignedPdfGeneration: row.unsigned_document_generation,
  signedPdfObject: row.signed_document_path,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export class ContractRepository {
  async createDraft(input: unknown, actorId: string): Promise<ContractEntity> {
    const value = input as {
      id?: string;
      clientId: string;
      snapshot: ContractSnapshot;
    };
    if (!value?.clientId || !value.snapshot) {
      throw new Error('clientId and snapshot are required');
    }
    return withContractTransaction(async (client) => {
      const id = value.id ?? randomUUID();
      const clientResult = await client.query<{
        first_name: string | null;
        last_name: string | null;
        email: string;
      }>(
        `SELECT first_name, last_name, email
         FROM public.phi_clients WHERE id = $1::uuid LIMIT 1`,
        [value.clientId]
      );
      const authoritativeClient = clientResult.rows[0];
      if (!authoritativeClient) throw new Error('Client not found');
      const snapshot = {
        ...value.snapshot,
        contractId: id,
        client: {
          id: value.clientId,
          name:
            [authoritativeClient.first_name, authoritativeClient.last_name]
              .filter(Boolean)
              .join(' ')
              .trim() || value.snapshot.client.name,
          email: authoritativeClient.email,
        },
      };
      await this.create(
        {
          id,
          clientId: value.clientId,
          templateId: snapshot.templateId,
          serviceType: snapshot.serviceType,
          snapshot,
        },
        client
      );
      await new EventRepository().append(
        {
          contractId: id,
          clientId: value.clientId,
          eventType: 'contract_created',
          actorType: actorId ? 'user' : 'system',
          actorId: actorId || null,
          correlationId: `contract-created-${id}`,
        },
        client
      );
      const entity = await this.findById(id, client);
      if (!entity) throw new Error('Contract insert did not return a row');
      return entity;
    });
  }

  async create(
    input: CreateContractRecord,
    client?: ContractDbClient
  ): Promise<SafeContractDto> {
    await queryWithClient(
      client,
      `INSERT INTO public.phi_contracts
       (id, client_id, signing_provider, template_identifier, template_version,
        status, field_snapshot, created_at, updated_at)
       VALUES ($1::uuid, $2::uuid, 'native', $3, $4, $5, $6::jsonb,
               CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        input.id,
        input.clientId,
        input.templateId,
        input.snapshot.templateVersion,
        input.status ?? 'draft',
        JSON.stringify(input.snapshot),
      ]
    );
    const created = await this.getById(input.id, input.clientId, client);
    if (!created) throw new Error('Contract insert did not return a row');
    return created;
  }

  async getById(
    contractId: string,
    clientId: string,
    client?: ContractDbClient
  ): Promise<SafeContractDto | null> {
    const { rows } = await queryWithClient<ContractRow>(
      client,
      `${SAFE_CONTRACT_SELECT}
       WHERE c.id = $1 AND c.client_id = $2
       LIMIT 1`,
      [contractId, clientId]
    );
    return rows[0] ? toSafeDto(rows[0]) : null;
  }

  async getByIdForUpdate(
    contractId: string,
    clientId: string,
    client: ContractDbClient
  ): Promise<SafeContractDto | null> {
    const { rows } = await queryWithClient<ContractRow>(
      client,
      `${SAFE_CONTRACT_SELECT}
       WHERE c.id = $1 AND c.client_id = $2
       LIMIT 1
       FOR UPDATE OF c`,
      [contractId, clientId]
    );
    return rows[0] ? toSafeDto(rows[0]) : null;
  }

  /** Internal system lookup. Callers must hold a transaction while processing it. */
  async getCompletionRecordForUpdate(
    contractId: string,
    client: ContractDbClient
  ): Promise<ContractCompletionRecord | null> {
    const { rows } = await queryWithClient<{
      id: string;
      client_id: string;
      status: ContractStatus;
      field_snapshot: ContractSnapshot;
    }>(
      client,
      `SELECT id, client_id, status, field_snapshot
       FROM public.phi_contracts
       WHERE id = $1
       LIMIT 1
       FOR UPDATE`,
      [contractId]
    );
    const row = rows[0];
    return row
      ? {
          id: row.id,
          clientId: row.client_id,
          status: row.status,
          snapshot: row.field_snapshot,
        }
      : null;
  }

  async listByClientId(
    clientId: string,
    client?: ContractDbClient
  ): Promise<ContractEntity[]> {
    const { rows } = await queryWithClient<EntityRow>(
      client,
      `${ENTITY_SELECT}
       WHERE c.client_id = $1::uuid
       ORDER BY c.created_at DESC, c.id DESC`,
      [clientId]
    );
    return rows.map(toEntity);
  }

  async updateStatus(
    contractId: string,
    clientId: string,
    status: ContractStatus,
    client?: ContractDbClient
  ): Promise<boolean> {
    const result = await queryWithClient(
      client,
      `UPDATE public.phi_contracts
       SET status = $3,
           signed_at = CASE WHEN $3 = 'signed' THEN COALESCE(signed_at, CURRENT_TIMESTAMP) ELSE signed_at END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND client_id = $2`,
      [contractId, clientId, status]
    );
    return result.rowCount === 1;
  }

  async findIdBySignNowDocumentId(
    signnowDocumentId: string,
    client?: ContractDbClient
  ): Promise<string | null> {
    const { rows } = await queryWithClient<{ id: string }>(
      client,
      `SELECT id
       FROM public.phi_contracts
       WHERE signnow_document_id = $1
       LIMIT 1`,
      [signnowDocumentId]
    );
    return rows[0]?.id ?? null;
  }

  async findById(
    id: string,
    client?: ContractDbClient
  ): Promise<ContractEntity | null> {
    const { rows } = await queryWithClient<EntityRow>(
      client,
      `${ENTITY_SELECT} WHERE c.id = $1::uuid LIMIT 1`,
      [id]
    );
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async findInvitationContract(
    contractId: string
  ): Promise<{ id: string; clientId: string; status: string } | null> {
    const { rows } = await queryWithClient<{
      id: string;
      client_id: string;
      status: string;
    }>(
      undefined,
      `SELECT id, client_id, status FROM public.phi_contracts
       WHERE id = $1::uuid AND signing_provider = 'native' LIMIT 1`,
      [contractId]
    );
    return rows[0]
      ? {
          id: rows[0].id,
          clientId: rows[0].client_id,
          status: rows[0].status,
        }
      : null;
  }

  async listAuditEvents(contractId: string): Promise<ContractAuditEvent[]> {
    const events = await new EventRepository().listForContract(contractId);
    return events.map((event) => ({
      id: event.id,
      contractId: event.contractId,
      type: event.type,
      occurredAt: event.occurredAt,
      actorType: event.actorType,
      actorId: event.actorId,
      metadata: { ...event.metadata },
    }));
  }

  async recordDownload(
    contractId: string,
    actorType: 'client' | 'user',
    actorId: string
  ): Promise<void> {
    const contract = await this.findById(contractId);
    if (!contract) throw new Error('Contract not found');
    await new EventRepository().append({
      contractId,
      clientId: contract.clientId,
      eventType: 'contract_downloaded',
      actorType,
      actorId,
    });
  }

  async voidContract(
    contractId: string,
    actorId: string,
    reason?: string
  ): Promise<ContractEntity> {
    return withContractTransaction(async (client) => {
      const current = await this.findByIdForUpdateInternal(contractId, client);
      if (!current) throw new Error('Contract not found');
      await this.updateStatus(contractId, current.clientId, 'voided', client);
      await client.query(
        `UPDATE public.signing_invitations
         SET revoked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE contract_id = $1::uuid AND revoked_at IS NULL
           AND completed_at IS NULL`,
        [contractId]
      );
      await new EventRepository().append(
        {
          contractId,
          clientId: current.clientId,
          eventType: 'contract_voided',
          actorType: actorId ? 'user' : 'system',
          actorId: actorId || null,
          payload: { reasonProvided: Boolean(reason) },
        },
        client
      );
      const entity = await this.findById(contractId, client);
      if (!entity) throw new Error('Contract not found');
      return entity;
    });
  }

  async sendAtomically(input: {
    contractId: string;
    actorId: string;
    unsignedPdfObject: string;
    unsignedPdfSha256: string;
    unsignedPdfGeneration: string | null;
    paymentSchedule: readonly unknown[];
    invitation: CreateInvitationInput;
    replaceInvitation: boolean;
  }): Promise<ContractEntity> {
    return withContractTransaction(async (client) => {
      const current = await this.findByIdForUpdateInternal(
        input.contractId,
        client
      );
      if (!current) throw new Error('Contract not found');
      if (current.status === 'draft') {
        await client.query(
          `UPDATE public.phi_contracts
           SET status = 'ready', updated_at = CURRENT_TIMESTAMP
           WHERE id = $1::uuid`,
          [input.contractId]
        );
      }
      await client.query(
        `UPDATE public.phi_contracts
         SET status = CASE WHEN $5::boolean THEN status ELSE 'sent' END,
             unsigned_document_path = $2,
             unsigned_document_hash = $3, unsigned_document_generation = $4,
             sent_at = COALESCE(sent_at, CURRENT_TIMESTAMP),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1::uuid`,
        [
          input.contractId,
          input.unsignedPdfObject,
          input.unsignedPdfSha256,
          input.unsignedPdfGeneration,
          input.replaceInvitation,
        ]
      );
      const invitations = new InvitationRepository();
      if (input.replaceInvitation) {
        await client.query(
          `UPDATE public.signing_invitations
           SET revoked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
           WHERE contract_id = $1::uuid AND revoked_at IS NULL
             AND completed_at IS NULL`,
          [input.contractId]
        );
      }
      await invitations.create(input.invitation, client);
      if (input.replaceInvitation) {
        await client.query(
          `UPDATE public.signing_invitations current
           SET resend_count = COALESCE((
                 SELECT MAX(previous.resend_count) + 1
                 FROM public.signing_invitations previous
                 WHERE previous.contract_id = current.contract_id
                   AND previous.id <> current.id
               ), 1),
               updated_at = CURRENT_TIMESTAMP
           WHERE current.id = $1::uuid`,
          [input.invitation.id]
        );
      }
      await new EventRepository().append(
        {
          contractId: input.contractId,
          clientId: current.clientId,
          eventType: input.replaceInvitation
            ? 'invitation_resent'
            : 'contract_sent',
          actorType: input.actorId ? 'user' : 'system',
          actorId: input.actorId || null,
        },
        client
      );
      await new OutboxRepository().enqueue(
        {
          contractId: input.contractId,
          clientId: current.clientId,
          type: 'billing_notification',
          idempotencyKey: `contract:${input.contractId}:sent:billing_notification`,
          payload: {
            clientName: current.snapshot.client.name,
            clientEmail: current.snapshot.client.email,
            serviceType: current.snapshot.serviceType,
            totalCents: current.snapshot.pricing.totalCents,
            depositCents: current.snapshot.pricing.depositCents,
            installmentCount: current.snapshot.pricing.installmentCents.length,
            paymentSchedule: input.paymentSchedule,
          },
        },
        client
      );
      const entity = await this.findById(input.contractId, client);
      if (!entity) throw new Error('Contract not found');
      return entity;
    });
  }

  async findPdfArtifactByHash(
    contractId: string,
    kind: 'unsigned' | 'completed',
    sha256: string
  ): Promise<{
    path: string;
    sha256: string;
    generation: string | null;
  } | null> {
    const prefix = kind === 'unsigned' ? 'unsigned' : 'signed';
    const { rows } = await queryWithClient<{
      path: string | null;
      sha256: string | null;
      generation: string | null;
    }>(
      undefined,
      `SELECT ${prefix}_document_path AS path,
              ${prefix}_document_hash AS sha256,
              ${prefix}_document_generation::text AS generation
       FROM public.phi_contracts
       WHERE id = $1::uuid AND ${prefix}_document_hash = $2
       LIMIT 1`,
      [contractId, sha256]
    );
    const row = rows[0];
    return row?.path && row.sha256
      ? { path: row.path, sha256: row.sha256, generation: row.generation }
      : null;
  }

  private async findByIdForUpdateInternal(
    id: string,
    client: ContractDbClient
  ): Promise<ContractEntity | null> {
    const { rows } = await queryWithClient<EntityRow>(
      client,
      `${ENTITY_SELECT} WHERE c.id = $1::uuid LIMIT 1 FOR UPDATE OF c`,
      [id]
    );
    return rows[0] ? toEntity(rows[0]) : null;
  }
}

export const contractRepository = new ContractRepository();
export const cloudSqlContractRepository = contractRepository;
