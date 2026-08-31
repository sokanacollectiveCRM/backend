import { nativeContracts } from '../../../config/env';
import { ContractDbClient, queryWithClient } from './db';

export const CONTRACT_OUTBOX_TYPES = [
  'signed_copy_email',
  'admin_contract_signed_notification',
  'billing_notification',
  'portal_eligibility',
  'quickbooks_deposit_invoice',
  'client_portal_notification',
  'generate_unsigned_document',
  'send_signing_invitation',
  'send_signing_reminder',
  'generate_signed_document',
  'archive_signed_document',
] as const;

export type ContractOutboxType = (typeof CONTRACT_OUTBOX_TYPES)[number];

export interface ContractOutboxMessage<T = Record<string, unknown>> {
  id: string;
  contractId: string;
  clientId: string;
  type: ContractOutboxType;
  idempotencyKey: string;
  payload: T;
  attemptCount: number;
  maxAttempts: number;
}

interface OutboxRow {
  id: string;
  kind: ContractOutboxType;
  idempotency_key: string;
  payload: Record<string, unknown>;
  attempts: number;
}

const toMessage = (row: OutboxRow): ContractOutboxMessage => ({
  id: row.id,
  contractId: String(row.payload.contractId ?? row.payload.contract_id ?? ''),
  clientId: String(row.payload.clientId ?? row.payload.client_id ?? ''),
  type: row.kind,
  idempotencyKey: row.idempotency_key,
  payload: row.payload,
  attemptCount: row.attempts,
  maxAttempts: nativeContracts.outboxMaxAttempts,
});

export interface EnqueueContractOutboxRecord {
  contractId: string;
  clientId: string;
  type: ContractOutboxType;
  idempotencyKey: string;
  payload?: Readonly<Record<string, unknown>>;
  availableAt?: Date | string;
}

export class OutboxRepository {
  async enqueue(
    input: EnqueueContractOutboxRecord,
    client?: ContractDbClient
  ): Promise<ContractOutboxMessage | null> {
    const payload = {
      ...(input.payload ?? {}),
      contractId: input.contractId,
      clientId: input.clientId,
    };
    const { rows } = await queryWithClient<OutboxRow>(
      client,
      `INSERT INTO public.contract_outbox
       (idempotency_key, kind, payload, status, available_at)
       SELECT $3, $4, $5::jsonb, 'pending',
              COALESCE($6::timestamptz, CURRENT_TIMESTAMP)
       FROM public.phi_contracts c
       WHERE c.id = $1::uuid AND c.client_id = $2::uuid
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING id, kind, idempotency_key, payload, attempts`,
      [
        input.contractId,
        input.clientId,
        input.idempotencyKey,
        input.type,
        JSON.stringify(payload),
        input.availableAt ?? null,
      ]
    );
    return rows[0] ? toMessage(rows[0]) : null;
  }

  async leaseBatch(
    workerId: string,
    limit = 20,
    leaseSeconds = 60,
    client?: ContractDbClient
  ): Promise<ContractOutboxMessage[]> {
    const { rows } = await queryWithClient<OutboxRow>(
      client,
      `WITH candidates AS (
         SELECT id
         FROM public.contract_outbox
         WHERE (
             status IN ('pending', 'failed')
             AND available_at <= CURRENT_TIMESTAMP
           )
           OR (
             status = 'processing'
             AND lease_expires_at <= CURRENT_TIMESTAMP
           )
         ORDER BY available_at, created_at, id
         FOR UPDATE SKIP LOCKED
         LIMIT $2
       )
       UPDATE public.contract_outbox o
       SET status = 'processing',
           leased_at = CURRENT_TIMESTAMP,
           lease_expires_at = CURRENT_TIMESTAMP + make_interval(secs => $3),
           lease_owner = $1,
           attempts = o.attempts + 1,
           updated_at = CURRENT_TIMESTAMP
       FROM candidates
       WHERE o.id = candidates.id
       RETURNING o.id, o.kind, o.idempotency_key, o.payload, o.attempts`,
      [workerId, Math.max(1, Math.min(limit, 100)), leaseSeconds]
    );
    return rows.map(toMessage);
  }

  async markCompleted(
    messageId: string,
    workerId: string,
    client?: ContractDbClient
  ): Promise<boolean> {
    const result = await queryWithClient(
      client,
      `UPDATE public.contract_outbox
       SET status = 'completed', completed_at = CURRENT_TIMESTAMP,
           leased_at = NULL, lease_expires_at = NULL, lease_owner = NULL,
           last_error = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1::uuid AND status = 'processing' AND lease_owner = $2`,
      [messageId, workerId]
    );
    return result.rowCount === 1;
  }

  async markFailed(
    messageId: string,
    workerId: string,
    errorMessage: string,
    retryDelaySeconds: number,
    client?: ContractDbClient
  ): Promise<boolean> {
    const result = await queryWithClient(
      client,
      `UPDATE public.contract_outbox
       SET status = CASE WHEN attempts >= $5 THEN 'dead_letter' ELSE 'failed' END,
           available_at = CURRENT_TIMESTAMP + make_interval(secs => $4),
           leased_at = NULL, lease_expires_at = NULL, lease_owner = NULL,
           last_error = LEFT($3, 2000), updated_at = CURRENT_TIMESTAMP
       WHERE id = $1::uuid AND status = 'processing' AND lease_owner = $2`,
      [
        messageId,
        workerId,
        errorMessage,
        Math.max(1, retryDelaySeconds),
        nativeContracts.outboxMaxAttempts,
      ]
    );
    return result.rowCount === 1;
  }
}

export const outboxRepository = new OutboxRepository();
export const cloudSqlOutboxRepository = outboxRepository;
