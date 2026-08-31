import { NodemailerService } from '../../../services/emailService';
import {
  ContractCalculationService,
  DepositInput,
  calculateContractPricing,
} from '../domain/calculations';
import type { NormalizedContractPayload } from '../domain/normalization';
import {
  ContractSnapshot,
  ContractStatus,
  ContractTemplateField,
  SafeContractDto,
  SafeContractSignatureDto,
} from '../domain/types';
import { buildSigningFieldsFromTemplate } from '../pdf/initialsPlacement';
import type { RegisteredPdfTemplate } from '../pdf/types';
import type { AdminDraftInput } from '../validation';
import { CreateInvitationInput, InvitationService } from './invitationService';

export interface ContractEntity {
  id: string;
  clientId: string;
  status: ContractStatus;
  snapshot: ContractSnapshot;
  signatures?: SafeContractSignatureDto[];
  unsignedPdfObject?: string | null;
  unsignedPdfSha256?: string | null;
  unsignedPdfGeneration?: string | null;
  signedPdfObject?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContractAuditEvent {
  id: string;
  contractId: string;
  type: string;
  occurredAt: Date;
  actorType: string;
  actorId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ContractRepository {
  createDraft(input: unknown, actorId: string): Promise<ContractEntity>;
  findById(id: string): Promise<ContractEntity | null>;
  listByClientId(clientId: string): Promise<ContractEntity[]>;
  listAuditEvents(contractId: string): Promise<ContractAuditEvent[]>;
  recordDownload(
    contractId: string,
    actorType: 'client' | 'user',
    actorId: string
  ): Promise<void>;
  voidContract(
    contractId: string,
    actorId: string,
    reason?: string
  ): Promise<ContractEntity>;
  /**
   * Persists the immutable PDF reference, payment schedule, invitation,
   * billing outbox row, sent event, and sent status in one transaction.
   */
  sendAtomically(input: {
    contractId: string;
    actorId: string;
    unsignedPdfObject: string;
    unsignedPdfSha256: string;
    unsignedPdfGeneration: string | null;
    paymentSchedule: readonly unknown[];
    invitation: CreateInvitationInput;
    replaceInvitation: boolean;
  }): Promise<ContractEntity>;
}

export interface FrozenPdf {
  objectName: string;
  sha256: string;
  generation: string | null;
}

export interface ContractPdfRenderer {
  freezeUnsigned(contract: ContractEntity): Promise<FrozenPdf>;
}

export interface ContractDownloadProvider {
  signedReadUrl(objectName: string, expiresInSeconds: number): Promise<string>;
}

export interface PaymentScheduleBuilder {
  build(snapshot: ContractSnapshot): readonly unknown[];
}

export interface ContractTemplateResolver {
  getRegisteredTemplate(
    identifier: string,
    version?: number
  ): Promise<RegisteredPdfTemplate | null>;
}

export interface PaymentScheduleCreator {
  ensure(snapshot: ContractSnapshot): Promise<void>;
}

export interface ContractInvitationMailer {
  send(input: {
    recipientEmail: string;
    recipientName: string;
    contractTitle: string;
    signingUrl: string;
    expiresAt: Date;
  }): Promise<void>;
}

export class NodemailerContractInvitationMailer
  implements ContractInvitationMailer
{
  constructor(
    private readonly email: Pick<
      NodemailerService,
      'sendNativeContractInvitation'
    > = new NodemailerService()
  ) {}

  async send(input: {
    recipientEmail: string;
    recipientName: string;
    contractTitle: string;
    signingUrl: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.email.sendNativeContractInvitation({
      clientEmail: input.recipientEmail,
      clientName: input.recipientName,
      contractTitle: input.contractTitle,
      signingUrl: input.signingUrl,
      expiresAt: input.expiresAt,
    });
  }
}

export class ContractNotFoundError extends Error {
  readonly statusCode = 404;
  constructor() {
    super('Contract not found');
  }
}

export class ContractConflictError extends Error {
  readonly statusCode = 409;
}

export class ContractService {
  constructor(
    private readonly contracts: ContractRepository,
    private readonly invitations: InvitationService,
    private readonly pdf: ContractPdfRenderer,
    private readonly downloads: ContractDownloadProvider,
    private readonly schedules: PaymentScheduleBuilder,
    private readonly templates: ContractTemplateResolver,
    private readonly paymentSchedules: PaymentScheduleCreator,
    private readonly invitationMailer: ContractInvitationMailer,
    private readonly signingBaseUrl: string
  ) {}

  async createDraft(input: unknown, actorId: string): Promise<SafeContractDto> {
    const draft = input as AdminDraftInput;
    const template = await this.templates.getRegisteredTemplate(
      draft.templateId
    );
    if (!template) {
      throw new ContractNotFoundError();
    }
    const pricing = calculateContractPricing({
      selectedServices: draft.selectedServices as ContractCalculationService[],
      adminFeeAmount: draft.adminFeeAmount,
      deposit: draft.deposit as DepositInput | undefined,
      installmentsCount: draft.installmentsCount,
    });
    const snapshot: ContractSnapshot = {
      contractId: '',
      templateId: draft.templateId,
      templateVersion: template.version,
      serviceType: draft.serviceType,
      client: {
        id: draft.clientId,
        name: draft.clientName,
        email: draft.clientEmail,
      },
      fields: buildSigningFieldsFromTemplate(
        draft.templateId,
        template.fields,
        pricing
      ),
      selectedServices: pricing.selectedServices,
      pricing,
      templateValues: {
        totalHours: pricing.selectedServices
          .filter((service) => service.type === 'hourly')
          .reduce((sum, service) => sum + (service.totalHours ?? 0), 0)
          .toString(),
        hourlyRateCents: pricing.selectedServices.find(
          (service) =>
            service.type === 'hourly' && (service.hourlyRateCents ?? 0) > 0
        )?.hourlyRateCents,
      },
      createdAt: new Date().toISOString(),
    };
    return this.toSafeDto(
      await this.contracts.createDraft(
        {
          clientId: draft.clientId,
          snapshot,
        },
        actorId
      )
    );
  }

  async createLegacyDraft(
    input: NormalizedContractPayload & { clientId: string },
    actorId: string
  ): Promise<SafeContractDto> {
    const identifier =
      input.templateId ??
      (input.templateClass === 'labor' ? 'labor_support' : 'postpartum');
    const template = await this.templates.getRegisteredTemplate(identifier);
    if (!template) throw new ContractNotFoundError();
    const snapshot: ContractSnapshot = {
      contractId: '',
      templateId: template.identifier,
      templateVersion: template.version,
      serviceType: input.serviceType,
      client: {
        id: input.clientId,
        name: input.clientName,
        email: input.clientEmail,
      },
      fields: buildSigningFieldsFromTemplate(
        template.identifier,
        template.fields,
        input.pricing
      ),
      selectedServices: input.selectedServices,
      pricing: input.pricing,
      templateValues: input.templateValues,
      createdAt: new Date().toISOString(),
    };
    return this.toSafeDto(
      await this.contracts.createDraft(
        {
          id: input.contractId,
          clientId: input.clientId,
          snapshot,
        },
        actorId
      )
    );
  }

  async getAdmin(contractId: string): Promise<SafeContractDto> {
    return this.toSafeDto(await this.requireContract(contractId));
  }

  async getForClient(
    contractId: string,
    clientId: string
  ): Promise<SafeContractDto> {
    const contract = await this.requireContract(contractId);
    if (contract.clientId !== clientId) throw new ContractNotFoundError();
    return this.toSafeDto(contract);
  }

  async listForClient(clientId: string): Promise<SafeContractDto[]> {
    const rows = await this.contracts.listByClientId(clientId);
    return rows.map((row) => this.toSafeDto(row));
  }

  async audit(contractId: string): Promise<ContractAuditEvent[]> {
    await this.requireContract(contractId);
    return this.contracts.listAuditEvents(contractId);
  }

  async void(
    contractId: string,
    actorId: string,
    reason?: string
  ): Promise<SafeContractDto> {
    return this.toSafeDto(
      await this.contracts.voidContract(contractId, actorId, reason)
    );
  }

  async send(
    contractId: string,
    actorId: string,
    replaceInvitation = false
  ): Promise<SafeContractDto> {
    const contract = await this.requireContract(contractId);
    const allowed = replaceInvitation
      ? ['sent', 'viewed', 'partially_signed']
      : ['draft', 'ready'];
    if (!allowed.includes(contract.status)) {
      throw new ContractConflictError(
        replaceInvitation
          ? 'Only an active contract can be resent'
          : 'Contract cannot be sent from its current status'
      );
    }

    const frozen = replaceInvitation
      ? this.requireFrozenPdf(contract)
      : await this.pdf.freezeUnsigned(contract);
    const prepared = this.invitations.prepare(contract.id, contract.clientId);
    if (!replaceInvitation) {
      await this.paymentSchedules.ensure(contract.snapshot);
    }
    const sent = await this.contracts.sendAtomically({
      contractId,
      actorId,
      unsignedPdfObject: frozen.objectName,
      unsignedPdfSha256: frozen.sha256,
      unsignedPdfGeneration: frozen.generation,
      // The domain schedule builder owns service-specific behavior, including
      // the Labor payment rule. The application layer never re-calculates it.
      paymentSchedule: this.schedules.build(contract.snapshot),
      invitation: prepared.input,
      replaceInvitation,
    });

    await this.invitationMailer.send({
      recipientEmail: contract.snapshot.client.email,
      recipientName: contract.snapshot.client.name,
      contractTitle: contract.snapshot.serviceType,
      signingUrl: `${this.signingBaseUrl}#invitation=${encodeURIComponent(prepared.token)}`,
      expiresAt: prepared.input.expiresAt,
    });

    return this.toSafeDto(sent);
  }

  async getDownload(
    contractId: string,
    clientId?: string,
    actor?: { type: 'client' | 'user'; id: string }
  ): Promise<{ url: string; expiresInSeconds: number }> {
    const contract = await this.requireContract(contractId);
    if (clientId && contract.clientId !== clientId) {
      throw new ContractNotFoundError();
    }
    const objectName =
      contract.status === 'signed'
        ? contract.signedPdfObject
        : contract.unsignedPdfObject;
    if (!objectName) throw new ContractNotFoundError();
    if (actor) {
      await this.contracts.recordDownload(contractId, actor.type, actor.id);
    }
    const expiresInSeconds = 5 * 60;
    return {
      url: await this.downloads.signedReadUrl(objectName, expiresInSeconds),
      expiresInSeconds,
    };
  }

  private async requireContract(id: string): Promise<ContractEntity> {
    const contract = await this.contracts.findById(id);
    if (!contract) throw new ContractNotFoundError();
    return contract;
  }

  private requireFrozenPdf(contract: ContractEntity): FrozenPdf {
    if (!contract.unsignedPdfObject || !contract.unsignedPdfSha256) {
      throw new ContractConflictError('Contract has no frozen unsigned PDF');
    }
    return {
      objectName: contract.unsignedPdfObject,
      sha256: contract.unsignedPdfSha256,
      generation: contract.unsignedPdfGeneration ?? null,
    };
  }

  private toSafeDto(contract: ContractEntity): SafeContractDto {
    return {
      id: contract.id,
      contractId: contract.id,
      status: contract.status,
      templateId: contract.snapshot.templateId,
      serviceType: contract.snapshot.serviceType,
      clientName: contract.snapshot.client.name,
      fields: contract.snapshot.fields,
      selectedServices: contract.snapshot.selectedServices,
      pricing: contract.snapshot.pricing,
      signatures: contract.signatures ?? [],
      createdAt: contract.createdAt.toISOString(),
      updatedAt: contract.updatedAt.toISOString(),
      totalAmount: contract.snapshot.pricing.totalCents,
      depositAmount: contract.snapshot.pricing.depositCents,
      signedAt: contract.signatures?.[0]?.signedAt,
    };
  }
}
