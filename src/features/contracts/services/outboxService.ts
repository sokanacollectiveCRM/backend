import { queryCloudSql } from '../../../db/cloudSqlPool';
import { contractSignatureCompletionService } from '../../../services/contractSignatureCompletionService';
import { NodemailerService } from '../../../services/emailService';
import { downloadObject } from '../../../services/gcs/documentStorage';
import { portalEligibilityService } from '../../../services/portalEligibilityService';
import { EventRepository } from '../repositories/eventRepository';
import {
  ContractOutboxMessage,
  ContractOutboxType,
  OutboxRepository,
  outboxRepository,
} from '../repositories/outboxRepository';

interface PostSigningPayload {
  contractId?: string;
  clientId?: string;
  clientName?: string;
  clientEmail?: string;
  serviceType?: string;
  totalCents?: number;
  depositCents?: number;
  installmentCount?: number;
  signedAt?: string;
}

export interface ProcessOutboxResult {
  leased: number;
  completed: number;
  failed: number;
}

type OutboxHandler = (
  message: ContractOutboxMessage<PostSigningPayload>
) => Promise<void>;

function dollars(cents: number | undefined): string {
  const value = Number.isFinite(cents) ? Number(cents) : 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value / 100);
}

function requirePayload(
  message: ContractOutboxMessage<PostSigningPayload>,
  key: keyof PostSigningPayload
): string {
  const value = message.payload[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Outbox payload is missing ${key}`);
  }
  return value;
}

export class ContractOutboxService {
  private readonly handlers: Record<ContractOutboxType, OutboxHandler>;

  constructor(
    private readonly repository: OutboxRepository = outboxRepository,
    private readonly emailService: NodemailerService = new NodemailerService()
  ) {
    this.handlers = {
      billing_notification: (message) =>
        this.handleBillingNotification(message),
      signed_copy_email: (message) => this.handleSignedCopyEmail(message),
      admin_contract_signed_notification: (message) =>
        this.handleAdminContractSignedNotification(message),
      portal_eligibility: (message) => this.handlePortalEligibility(message),
      quickbooks_deposit_invoice: (message) =>
        this.handleQboDepositInvoice(message),
      client_portal_notification: (message) =>
        this.handleClientPortalNotification(message),
      // PDF creation/archival is completed synchronously under the contract
      // transaction boundary; these rows are lifecycle receipts.
      generate_unsigned_document: async () => undefined,
      generate_signed_document: async () => undefined,
      archive_signed_document: async () => undefined,
      send_signing_invitation: async () => undefined,
      send_signing_reminder: async () => undefined,
    };
  }

  async processBatch(
    workerId: string,
    limit = 20
  ): Promise<ProcessOutboxResult> {
    const messages = await this.repository.leaseBatch(workerId, limit);
    let completed = 0;
    let failed = 0;

    for (const rawMessage of messages) {
      const message = rawMessage as ContractOutboxMessage<PostSigningPayload>;
      try {
        await this.handlers[message.type](message);
        await this.repository.markCompleted(message.id, workerId);
        completed += 1;
      } catch (error) {
        const reason =
          error instanceof Error
            ? `handler_error:${error.constructor.name.slice(0, 80)}`
            : 'handler_error:unknown';
        const retryDelaySeconds = Math.min(
          3600,
          30 * 2 ** Math.max(0, message.attemptCount - 1)
        );
        await this.repository.markFailed(
          message.id,
          workerId,
          reason,
          retryDelaySeconds
        );
        failed += 1;
      }
    }

    return { leased: messages.length, completed, failed };
  }

  async handle(message: ContractOutboxMessage): Promise<void> {
    const handler = this.handlers[message.type];
    if (!handler) throw new Error(`Unsupported outbox type: ${message.type}`);
    await handler(message as ContractOutboxMessage<PostSigningPayload>);
  }

  private async handleBillingNotification(
    message: ContractOutboxMessage<PostSigningPayload>
  ): Promise<void> {
    await this.emailService.sendContractInitiatedBillingEmail({
      clientName: requirePayload(message, 'clientName'),
      contractType: message.payload.serviceType || 'Contract',
      contractTotal: dollars(message.payload.totalCents),
      contractId: message.contractId,
      depositAmount: dollars(message.payload.depositCents),
      installmentCount: message.payload.installmentCount ?? null,
    });
  }

  private async handleSignedCopyEmail(
    message: ContractOutboxMessage<PostSigningPayload>
  ): Promise<void> {
    const email = requirePayload(message, 'clientEmail');
    const name = requirePayload(message, 'clientName');
    const { rows } = await queryCloudSql<{ signed_document_path: string }>(
      `SELECT signed_document_path
       FROM public.phi_contracts
       WHERE id = $1::uuid AND client_id = $2::uuid
       LIMIT 1`,
      [message.contractId, message.clientId]
    );
    if (!rows[0]?.signed_document_path) {
      throw new Error('Signed contract document is unavailable');
    }
    const pdf = await downloadObject(rows[0].signed_document_path);
    await this.emailService.sendSignedContractCopy({
      clientEmail: email,
      clientName: name,
      contractTitle: message.payload.serviceType || 'Sokana contract',
      contractId: message.contractId,
      pdf,
    });
    await new EventRepository().append({
      contractId: message.contractId,
      clientId: message.clientId,
      eventType: 'signed_copy_sent',
      actorType: 'worker',
      correlationId: message.id,
      payload: { outboxId: message.id },
    });
  }

  private async handleAdminContractSignedNotification(
    message: ContractOutboxMessage<PostSigningPayload>
  ): Promise<void> {
    await this.emailService.sendAdminContractSignedNotification({
      clientName: requirePayload(message, 'clientName'),
      contractType: message.payload.serviceType || 'Contract',
      contractId: message.contractId,
      contractTotal: dollars(message.payload.totalCents),
      signedAt:
        typeof message.payload.signedAt === 'string' &&
        message.payload.signedAt.trim()
          ? message.payload.signedAt
          : new Date().toISOString(),
    });
    await new EventRepository().append({
      contractId: message.contractId,
      clientId: message.clientId,
      eventType: 'admin_contract_signed_notification_sent',
      actorType: 'worker',
      correlationId: message.id,
      payload: { outboxId: message.id },
    });
  }

  private async handlePortalEligibility(
    message: ContractOutboxMessage<PostSigningPayload>
  ): Promise<void> {
    await portalEligibilityService.computeAndPersist(message.clientId, {
      force_contract_signed: true,
      event_source: 'contract_outbox',
    });
  }

  private async handleQboDepositInvoice(
    message: ContractOutboxMessage<PostSigningPayload>
  ): Promise<void> {
    const result =
      await contractSignatureCompletionService.finalizeSignedContract(
        message.contractId
      );
    if (!result.contract_id) {
      throw new Error(`Contract not found: ${message.contractId}`);
    }
  }

  private async handleClientPortalNotification(
    message: ContractOutboxMessage<PostSigningPayload>
  ): Promise<void> {
    const email = requirePayload(message, 'clientEmail');
    const name = requirePayload(message, 'clientName');
    const portalUrl =
      process.env.FRONTEND_URL || 'https://crm.sokanacollective.com';
    await this.emailService.sendEmail(
      email,
      'Your Sokana portal has been updated',
      `Dear ${name},\n\nYour signed contract is available in your client portal: ${portalUrl}\n\nBest regards,\nThe Sokana Team`
    );
  }
}

export const contractOutboxService = new ContractOutboxService();
export const outboxService = contractOutboxService;
