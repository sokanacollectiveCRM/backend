import { nativeContracts } from '../../../config/env';
import { NodemailerService } from '../../../services/emailService';
import { downloadObject } from '../../../services/gcs/documentStorage';

export interface ContractCompletionEmailInput {
  contractId: string;
  clientName: string;
  clientEmail: string;
  serviceType: string;
  totalCents: number;
  signedDocumentPath: string;
  signedAt?: Date;
}

function formatDollars(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

export class ContractCompletionEmailService {
  constructor(
    private readonly emailService: Pick<
      NodemailerService,
      'sendSignedContractCopy' | 'sendAdminContractSignedNotification'
    > = new NodemailerService()
  ) {}

  async deliver(input: ContractCompletionEmailInput): Promise<void> {
    const pdf = await downloadObject(input.signedDocumentPath);
    const contractTitle = input.serviceType || 'Sokana contract';
    const signedAt = (input.signedAt ?? new Date()).toISOString();

    await this.emailService.sendSignedContractCopy({
      clientEmail: input.clientEmail,
      clientName: input.clientName,
      contractTitle,
      contractId: input.contractId,
      pdf,
    });
    await this.emailService.sendAdminContractSignedNotification({
      clientName: input.clientName,
      contractType: contractTitle,
      contractId: input.contractId,
      contractTotal: formatDollars(input.totalCents),
      signedAt,
    });
  }
}

export const contractCompletionEmailService =
  new ContractCompletionEmailService();

export function shouldDeliverCompletionEmailsSynchronously(): boolean {
  return nativeContracts.enabled && !nativeContracts.outboxEnabled;
}
