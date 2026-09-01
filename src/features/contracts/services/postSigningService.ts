import { ContractStatus } from '../domain/types';
import {
  contractRepository,
  eventRepository,
  outboxRepository,
  withContractTransaction,
} from '../repositories';
import { ContractOutboxType } from '../repositories/outboxRepository';

export interface PostSigningResult {
  contractId: string;
  clientId: string;
  contractMarkedSigned: boolean;
  queued: ContractOutboxType[];
}

export interface CompleteNativeContractOptions {
  source?: string;
  actorId?: string | null;
  signedCopyUrl?: string | null;
}

export class PostSigningService {
  async complete(
    contractId: string,
    options: CompleteNativeContractOptions = {}
  ): Promise<PostSigningResult | null> {
    return withContractTransaction(async (client) => {
      const contract = await contractRepository.getCompletionRecordForUpdate(
        contractId,
        client
      );
      if (!contract) return null;

      const wasSigned = contract.status === 'signed';
      if (!wasSigned) {
        await contractRepository.updateStatus(
          contract.id,
          contract.clientId,
          'signed' as ContractStatus,
          client
        );
        await eventRepository.append(
          {
            contractId: contract.id,
            clientId: contract.clientId,
            eventType: 'contract_signed',
            actorId: options.actorId ?? null,
            source: options.source ?? 'native_signing',
            payload: {},
          },
          client
        );
      }

      const payload = {
        contractId: contract.id,
        clientId: contract.clientId,
        clientName: contract.snapshot.client.name,
        clientEmail: contract.snapshot.client.email,
        serviceType: contract.snapshot.serviceType,
        totalCents: contract.snapshot.pricing.totalCents,
        depositCents: contract.snapshot.pricing.depositCents,
        installmentCount: contract.snapshot.pricing.installmentCents.length,
        signedCopyUrl: options.signedCopyUrl ?? null,
      };

      const types: ContractOutboxType[] = [
        'billing_notification',
        'signed_copy_email',
        'portal_eligibility',
        'quickbooks_deposit_invoice',
      ];
      const queued: ContractOutboxType[] = [];
      for (const type of types) {
        const message = await outboxRepository.enqueue(
          {
            contractId: contract.id,
            clientId: contract.clientId,
            type,
            idempotencyKey: `contract:${contract.id}:signed:${type}`,
            payload,
          },
          client
        );
        if (message) queued.push(type);
      }

      return {
        contractId: contract.id,
        clientId: contract.clientId,
        contractMarkedSigned: !wasSigned,
        queued,
      };
    });
  }
}

export const postSigningService = new PostSigningService();
