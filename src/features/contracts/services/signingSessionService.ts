import { createHash } from 'crypto';

import { logger } from '../../../common/utils/logger';
import {
  ContractSignatureValue,
  ContractSnapshot,
  SafeContractSignatureDto,
} from '../domain/types';
import { PdfTemplateField } from '../pdf/types';
import {
  type ContractCompletionEmailInput,
  contractCompletionEmailService,
  shouldDeliverCompletionEmailsSynchronously,
} from './contractCompletionEmailService';
import { InvitationService } from './invitationService';
import { RateLimitService } from './rateLimitService';
import { VerifiedSigningContext } from './signingAccessSessionService';

/** Credential-free PDF fallback served behind session authorization. */
export const SIGNING_SESSION_DOCUMENT_PATH = '/signing/session/document';

export interface SigningContractRecord {
  id: string;
  status: string;
  clientName: string;
  serviceType: string;
  clientId: string;
  templateIdentifier: string;
  templateVersion: number;
  snapshot: ContractSnapshot;
  signingManifest: readonly PdfTemplateField[];
  unsignedPdfObject: string;
  unsignedPdfSha256: string;
  unsignedPdfGeneration: string | null;
}

export interface SigningProgressRecord {
  fieldId: string;
  completedAt: Date;
}

export interface SigningSessionRepository {
  getContract(contractId: string): Promise<SigningContractRecord | null>;
  getProgress(invitationId: string): Promise<readonly SigningProgressRecord[]>;
  /** First call records viewed_at, a viewed event, and status transition. */
  recordFirstViewed(
    invitationId: string,
    contractId: string,
    viewedAt: Date,
    evidence?: RequestEvidence
  ): Promise<void>;
  saveProgress(
    invitationId: string,
    contractId: string,
    completedFields: readonly SigningProgressRecord[],
    evidence?: RequestEvidence
  ): Promise<readonly SigningProgressRecord[]>;
  /**
   * Takes a row lock plus a transaction-scoped advisory lock. The callback is
   * run at most once for concurrent completion attempts.
   */
  withCompletionLock<T>(
    invitationId: string,
    work: (transaction: unknown) => Promise<T>
  ): Promise<T>;
  findSignedResult(
    contractId: string,
    transaction: unknown
  ): Promise<SignedCompletionResult | null>;
  getContractForCompletion(
    invitationId: string,
    transaction: unknown
  ): Promise<SigningContractRecord | null>;
  /**
   * Persists signature metadata, signed PDF reference/hash, signed status,
   * completion event and provider-neutral completion/outbox rows atomically.
   */
  finalizeCompletion(
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
      evidence?: RequestEvidence;
    },
    transaction: unknown
  ): Promise<SignedCompletionResult>;
}

export interface SignedPdfFinalizer {
  finalize(input: {
    contract: SigningContractRecord;
    signerName: string;
    initials: string;
    signature: ContractSignatureValue;
    signedAt: Date;
    completedFieldIds: readonly string[];
    correlationId?: string | null;
  }): Promise<{
    objectName: string;
    sha256: string;
    generation: string | null;
    signatureObjectPath: string | null;
  }>;
}

export interface SigningSessionDto {
  contractId: string;
  title: string;
  signerName: string;
  status: string;
  pdfUrl: string;
  signingManifest: readonly PdfTemplateField[];
  progress: ReadonlyArray<{ fieldId: string; completedAt: string }>;
  consent: { language: string; version: string };
  expiresAt: string;
  canContinue: boolean;
}

export interface SignedCompletionResult {
  contractId: string;
  status: 'signed';
  signature: SafeContractSignatureDto;
  signedAt: string;
}

export interface CompleteSigningInput {
  initials: string;
  consent: boolean;
  signature: ContractSignatureValue;
  completedFieldIds: readonly string[];
}

export interface RequestEvidence {
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
}

export interface SigningDocumentUrlProvider {
  signedReadUrl(objectName: string, expiresInSeconds: number): Promise<string>;
  download(objectName: string): Promise<Buffer>;
}

const CONSENT_VERSION = 'native-contract-consent-v1';
const CONSENT_LANGUAGE =
  'I consent to use electronic records and signatures for this contract.';

export class SigningInputError extends Error {
  readonly statusCode = 400;
}

export class SigningSessionService {
  constructor(
    private readonly invitations: InvitationService,
    private readonly sessions: SigningSessionRepository,
    private readonly rateLimits: RateLimitService,
    private readonly finalizer: SignedPdfFinalizer,
    private readonly documents: SigningDocumentUrlProvider,
    private readonly pdfUrlTtlSeconds = 300
  ) {}

  async get(
    context: VerifiedSigningContext,
    evidence: RequestEvidence = {}
  ): Promise<SigningSessionDto> {
    const contract = await this.requireContract(context.contractId);
    this.assertContractBinding(contract, context);
    const viewedAt = new Date();
    await this.sessions.recordFirstViewed(
      context.invitationId,
      contract.id,
      viewedAt,
      evidence
    );
    if (contract.status === 'sent') contract.status = 'viewed';
    const progress = await this.sessions.getProgress(context.invitationId);
    return this.toSafeSession(contract, progress, context.invitationExpiresAt);
  }

  async saveProgress(
    context: VerifiedSigningContext,
    fieldIds: readonly string[],
    evidence: RequestEvidence = {}
  ): Promise<SigningSessionDto> {
    const contract = await this.requireContract(context.contractId);
    this.assertContractBinding(contract, context);
    const knownIds = new Set(contract.signingManifest.map((field) => field.id));
    const uniqueIds = [...new Set(fieldIds)];
    if (
      uniqueIds.length > contract.signingManifest.length ||
      uniqueIds.some((id) => !knownIds.has(id))
    ) {
      throw new SigningInputError('Progress contains an unknown field');
    }
    const now = new Date();
    // Client timestamps are intentionally unsupported.
    const progress = await this.sessions.saveProgress(
      context.invitationId,
      contract.id,
      uniqueIds.map((fieldId) => ({ fieldId, completedAt: now })),
      evidence
    );
    if (uniqueIds.length > 0 && ['sent', 'viewed'].includes(contract.status)) {
      contract.status = 'partially_signed';
    }
    return this.toSafeSession(contract, progress, context.invitationExpiresAt);
  }

  async getDocument(
    context: VerifiedSigningContext,
    evidence: RequestEvidence = {}
  ): Promise<Buffer> {
    const contract = await this.requireContract(context.contractId);
    this.assertContractBinding(contract, context);
    const bytes = await this.documents.download(contract.unsignedPdfObject);
    const actualHash = createHash('sha256').update(bytes).digest('hex');
    if (actualHash !== contract.unsignedPdfSha256) {
      throw new Error('Unsigned contract document integrity check failed');
    }
    return bytes;
  }

  async complete(
    context: VerifiedSigningContext,
    input: CompleteSigningInput,
    evidence: RequestEvidence = {}
  ): Promise<SignedCompletionResult> {
    const contract = await this.requireContract(context.contractId);
    this.assertContractBinding(contract, context);
    this.validateCompletion(contract, input);

    let completionEmailInput: ContractCompletionEmailInput | null = null;
    const result = await this.sessions.withCompletionLock(
      context.invitationId,
      async (transaction) => {
        const lockedVerification =
          await this.invitations.verifySessionInvitation(context.invitationId);
        if (
          lockedVerification.invitation.id !== context.invitationId ||
          lockedVerification.contract.id !== contract.id
        ) {
          throw new SigningInputError('Signing session unavailable');
        }
        const existing = await this.sessions.findSignedResult(
          contract.id,
          transaction
        );
        if (existing) return existing;
        const lockedContract = await this.sessions.getContractForCompletion(
          context.invitationId,
          transaction
        );
        if (
          !lockedContract ||
          lockedContract.id !== contract.id ||
          lockedContract.clientId !== context.clientId ||
          !['sent', 'viewed', 'partially_signed'].includes(
            lockedContract.status
          )
        ) {
          throw new SigningInputError('Signing session unavailable');
        }
        this.validateCompletion(lockedContract, input);

        const signedAt = new Date();
        const pdf = await this.finalizer.finalize({
          contract: lockedContract,
          signerName: lockedContract.clientName,
          initials: input.initials.trim(),
          signature: input.signature,
          signedAt,
          completedFieldIds: [...new Set(input.completedFieldIds)],
          correlationId: evidence.correlationId,
        });
        const result = await this.sessions.finalizeCompletion(
          {
            invitationId: context.invitationId,
            contractId: contract.id,
            signerName: lockedContract.clientName,
            initials: input.initials.trim(),
            signature: input.signature,
            consentedAt: signedAt,
            signedAt,
            completedFieldIds: [...new Set(input.completedFieldIds)],
            signedPdfObject: pdf.objectName,
            signedPdfSha256: pdf.sha256,
            signedPdfGeneration: pdf.generation,
            signatureObjectPath: pdf.signatureObjectPath,
            evidence,
          },
          transaction
        );
        completionEmailInput = {
          contractId: contract.id,
          clientName: lockedContract.clientName,
          clientEmail: lockedContract.snapshot.client.email,
          serviceType: lockedContract.serviceType,
          totalCents: lockedContract.snapshot.pricing.totalCents,
          signedDocumentPath: pdf.objectName,
          signedAt,
        };
        return result;
      }
    );

    if (shouldDeliverCompletionEmailsSynchronously() && completionEmailInput) {
      try {
        await contractCompletionEmailService.deliver(completionEmailInput);
      } catch (error) {
        logger.error(
          {
            service: 'native_contracts',
            operation: 'completion_email_delivery',
            contractId: completionEmailInput.contractId,
          },
          error instanceof Error
            ? error.message
            : 'Failed to deliver completion emails'
        );
      }
    }

    return result;
  }

  private assertContractBinding(
    contract: SigningContractRecord,
    context: VerifiedSigningContext
  ): void {
    if (
      contract.id !== context.contractId ||
      contract.clientId !== context.clientId
    ) {
      throw new SigningInputError('Signing session unavailable');
    }
  }

  private async requireContract(id: string): Promise<SigningContractRecord> {
    const contract = await this.sessions.getContract(id);
    if (!contract) throw new SigningInputError('Signing session unavailable');
    return contract;
  }

  private validateCompletion(
    contract: SigningContractRecord,
    input: CompleteSigningInput
  ): void {
    if (input.consent !== true || !input.initials?.trim()) {
      throw new SigningInputError(
        'Signer name, initials, and consent are required'
      );
    }
    if (
      !input.signature ||
      (input.signature.type === 'typed' && !input.signature.text?.trim()) ||
      (input.signature.type === 'drawn' &&
        !/^data:image\/png;base64,[a-z0-9+/=]+$/i.test(
          input.signature.dataUrl || ''
        ))
    ) {
      throw new SigningInputError('A valid signature is required');
    }
    const completed = new Set(input.completedFieldIds);
    const known = new Set(contract.signingManifest.map((field) => field.id));
    if ([...completed].some((id) => !known.has(id))) {
      throw new SigningInputError('Completion contains an unknown field');
    }
    const missingRequired = contract.signingManifest.some(
      (field) => field.required && !completed.has(field.id)
    );
    if (missingRequired) {
      throw new SigningInputError('All required fields must be completed');
    }
  }

  private async toSafeSession(
    contract: SigningContractRecord,
    progress: readonly SigningProgressRecord[],
    expiresAt: Date
  ): Promise<SigningSessionDto> {
    let pdfUrl: string;
    try {
      pdfUrl = await this.documents.signedReadUrl(
        contract.unsignedPdfObject,
        this.pdfUrlTtlSeconds
      );
    } catch {
      pdfUrl = SIGNING_SESSION_DOCUMENT_PATH;
    }
    return {
      contractId: contract.id,
      title: contract.serviceType,
      signerName: contract.clientName,
      status: contract.status,
      pdfUrl,
      signingManifest: contract.signingManifest,
      progress: progress.map((item) => ({
        fieldId: item.fieldId,
        completedAt: item.completedAt.toISOString(),
      })),
      consent: {
        language: CONSENT_LANGUAGE,
        version: CONSENT_VERSION,
      },
      expiresAt: expiresAt.toISOString(),
      canContinue:
        expiresAt.getTime() > Date.now() &&
        ['sent', 'viewed', 'partially_signed'].includes(contract.status),
    };
  }
}
