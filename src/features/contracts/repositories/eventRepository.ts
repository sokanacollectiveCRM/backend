import { randomUUID } from 'crypto';
import { isIP } from 'net';

import { ContractDbClient, queryWithClient } from './db';

export type ContractEventActorType =
  | 'client'
  | 'user'
  | 'system'
  | 'worker'
  | 'provider';

export interface ContractEventDto {
  id: string;
  contractId: string;
  clientId: string;
  type: string;
  occurredAt: Date;
  actorType: ContractEventActorType;
  actorId: string | null;
  metadata: Readonly<Record<string, unknown>>;
}

export interface AppendContractEventRecord {
  contractId: string;
  clientId: string;
  eventType: string;
  actorType?: ContractEventActorType;
  actorId?: string | null;
  correlationId?: string;
  source?: string;
  payload?: Readonly<Record<string, unknown>>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

interface EventRow {
  id: string;
  contract_id: string;
  client_id: string;
  event_type: string;
  actor_type: ContractEventActorType;
  actor_client_id: string | null;
  actor_user_id: string | null;
  server_timestamp: Date;
  metadata: Record<string, unknown>;
}

const toDto = (row: EventRow): ContractEventDto => ({
  id: String(row.id),
  contractId: row.contract_id,
  clientId: row.client_id,
  type: row.event_type,
  occurredAt: row.server_timestamp,
  actorType: row.actor_type,
  actorId: row.actor_client_id ?? row.actor_user_id,
  metadata: row.metadata,
});

export class EventRepository {
  /** Audit events are append-only; update and delete are intentionally absent. */
  async append(
    input: AppendContractEventRecord,
    client?: ContractDbClient
  ): Promise<ContractEventDto> {
    const actorType = input.actorType ?? (input.actorId ? 'user' : 'system');
    const metadata = sanitizeEventMetadata(input.payload, input.source);
    const { rows } = await queryWithClient<EventRow>(
      client,
      `INSERT INTO public.contract_events
       (contract_id, client_id, event_type, actor_type, actor_client_id,
        actor_user_id, correlation_id, ip_address, user_agent, metadata)
       SELECT c.id, c.client_id, $3::public.contract_event_type, $4,
              CASE WHEN $4 = 'client' THEN c.client_id ELSE NULL END,
              CASE WHEN $4 = 'user' THEN $5 ELSE NULL END,
              $6, NULLIF($7, '')::inet, NULLIF($8, ''), $9::jsonb
       FROM public.phi_contracts c
       WHERE c.id = $1::uuid AND c.client_id = $2::uuid
       RETURNING id, contract_id, client_id, event_type, actor_type,
                 actor_client_id, actor_user_id, server_timestamp, metadata`,
      [
        input.contractId,
        input.clientId,
        input.eventType,
        actorType,
        input.actorId ?? null,
        input.correlationId ?? randomUUID(),
        input.ipAddress && isIP(input.ipAddress) ? input.ipAddress : null,
        sanitizeUserAgent(input.userAgent),
        JSON.stringify(metadata),
      ]
    );
    if (!rows[0]) throw new Error('Contract not found for client');
    return toDto(rows[0]);
  }

  async listForContract(
    contractId: string,
    client?: ContractDbClient
  ): Promise<ContractEventDto[]> {
    const { rows } = await queryWithClient<EventRow>(
      client,
      `SELECT id, contract_id, client_id, event_type, actor_type,
              actor_client_id, actor_user_id, server_timestamp, metadata
       FROM public.contract_events
       WHERE contract_id = $1::uuid
       ORDER BY server_timestamp, id`,
      [contractId]
    );
    return rows.map(toDto);
  }
}

function sanitizeUserAgent(value?: string | null): string | null {
  if (!value) return null;
  const sanitized = value.replace(/[\u0000-\u001f\u007f\r\n]+/g, ' ').trim();
  return sanitized ? sanitized.slice(0, 512) : null;
}

function sanitizeEventMetadata(
  payload?: Readonly<Record<string, unknown>>,
  source?: string
): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};
  if (source) metadata.source = source.slice(0, 128);
  if (typeof payload?.reasonProvided === 'boolean') {
    metadata.reasonProvided = payload.reasonProvided;
  }
  if (typeof payload?.outboxId === 'string' && payload.outboxId.length <= 128) {
    metadata.outboxId = payload.outboxId;
  }
  if (
    Array.isArray(payload?.completedFieldIds) &&
    payload.completedFieldIds.length <= 500 &&
    payload.completedFieldIds.every(
      (value) =>
        typeof value === 'string' &&
        value.length <= 128 &&
        /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value)
    )
  ) {
    metadata.completedFieldIds = payload.completedFieldIds;
  }
  return metadata;
}

export const eventRepository = new EventRepository();
export const cloudSqlEventRepository = eventRepository;
