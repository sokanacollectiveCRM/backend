import {
  ContractSignatureValue,
  ContractSnapshot,
  NormalizedCoordinates,
} from '../domain/types';

export type SnapshotFieldSource =
  | 'contractId'
  | 'serviceType'
  | 'client.name'
  | 'client.email'
  | 'createdAt'
  | 'selectedServices.summary'
  | 'selectedServices.totalHours'
  | 'templateValues.hourlyRateCents'
  | 'templateValues.overnightFeeCents'
  | 'pricing.servicesSubtotalCents'
  | 'pricing.discountCents'
  | 'pricing.adminFeeCents'
  | 'pricing.totalCents'
  | 'pricing.depositCents'
  | 'pricing.balanceCents'
  | 'pricing.installmentCents';

export type PdfTemplateField =
  | {
      id: string;
      kind: 'snapshot_text';
      source: SnapshotFieldSource;
      page: number;
      coordinates: NormalizedCoordinates;
      required?: boolean;
      fontSize?: number;
      label?: string;
    }
  | {
      id: string;
      kind: 'signature' | 'initials' | 'signing_date' | 'acknowledgment';
      page: number;
      coordinates: NormalizedCoordinates;
      required: boolean;
      fontSize?: number;
      label?: string;
    };

export interface RegisteredPdfTemplate {
  identifier: string;
  version: number;
  objectPath: string;
  sha256: string;
  fields: readonly PdfTemplateField[];
}

/** Port implemented by the Cloud SQL template repository. */
export interface PdfTemplateRepository {
  getRegisteredTemplate(
    identifier: string,
    version?: number
  ): Promise<RegisteredPdfTemplate | null>;
}

export interface PdfObjectStorage {
  download(path: string): Promise<Buffer>;
  upload(
    path: string,
    bytes: Buffer,
    metadata: Record<string, string>
  ): Promise<{ generation: string | null; size: number | null }>;
}

export interface ExistingPdfArtifact {
  path: string;
  sha256: string;
  generation: string | null;
}

/** Optional persistence lookup used to avoid uploading the same final bytes twice. */
export interface PdfArtifactRepository {
  findByHash(
    contractId: string,
    kind: 'unsigned' | 'completed',
    sha256: string
  ): Promise<ExistingPdfArtifact | null>;
}

export interface GeneratedPdfArtifact {
  path: string;
  sha256: string;
  generation: string | null;
  reused: boolean;
}

export interface LoadedPdfTemplate {
  registration: RegisteredPdfTemplate;
  bytes: Buffer;
}

export interface AdoptedSignature {
  value: ContractSignatureValue;
  initials: string;
  /** IDs of acknowledgment fields explicitly adopted by the signer. */
  acknowledgedFieldIds: readonly string[];
}

export interface CompletePdfInput {
  snapshot: ContractSnapshot;
  unsignedPdf: Buffer;
  expectedUnsignedSha256: string;
  adoptedSignature: AdoptedSignature;
  signerName: string;
  evidenceId: string;
  correlationId: string;
}

export interface PdfGenerationDependencies {
  templates: PdfTemplateRepository;
  storage: PdfObjectStorage;
  artifacts?: PdfArtifactRepository;
  now?: () => Date;
}
