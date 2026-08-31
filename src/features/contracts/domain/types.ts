export const CONTRACT_STATUSES = [
  'draft',
  'ready',
  'sent',
  'viewed',
  'partially_signed',
  'signed',
  'declined',
  'expired',
  'voided',
] as const;

export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export const TEMPLATE_FIELD_TYPES = [
  'initials',
  'signature',
  'signing_date',
  'acknowledgment',
  'optional_text',
] as const;

export type TemplateFieldType = (typeof TEMPLATE_FIELD_TYPES)[number];

/** Coordinates are fractions of the rendered page dimensions (0 through 1). */
export interface NormalizedCoordinates {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ContractTemplateField {
  id: string;
  type: TemplateFieldType;
  page: number;
  coordinates: NormalizedCoordinates;
  label?: string;
  required: boolean;
}

export type ServicePricingType = 'flat' | 'hourly';

export interface ContractServiceSnapshot {
  id: string;
  name: string;
  type: ServicePricingType;
  amountCents?: number;
  hourlyRateCents?: number;
  totalHours?: number;
}

export interface ContractPricingSnapshot {
  servicesSubtotalCents: number;
  discountRate: number;
  discountCents: number;
  servicesAfterDiscountCents: number;
  adminFeeCents: number;
  totalCents: number;
  depositCents: number;
  balanceCents: number;
  installmentCents: number[];
}

export interface ContractSnapshot {
  contractId: string;
  templateId: string;
  templateVersion: number;
  serviceType: string;
  client: {
    id?: string;
    name: string;
    email: string;
  };
  fields: readonly ContractTemplateField[];
  selectedServices: readonly ContractServiceSnapshot[];
  pricing: ContractPricingSnapshot;
  templateValues?: {
    totalHours?: string;
    hourlyRateCents?: number;
    overnightFeeCents?: number;
  };
  createdAt: string;
}

export type SignatureKind = 'typed' | 'drawn';

export type ContractSignatureValue =
  | {
      type: 'typed';
      text: string;
      fontFamily?: string;
    }
  | {
      type: 'drawn';
      dataUrl: string;
    };

export interface ContractSignature {
  id: string;
  contractId: string;
  signerId: string;
  signerName: string;
  value: ContractSignatureValue;
  initials: string;
  consentedAt: string;
  signedAt: string;
  completedFieldIds: readonly string[];
}

/** API-safe signature metadata. It deliberately excludes typed/drawn signature data. */
export interface SafeContractSignatureDto {
  id: string;
  signerId: string;
  signerName: string;
  type: SignatureKind;
  signedAt: string;
  completedFieldIds: readonly string[];
}

/** Provider-neutral contract representation safe to return to authenticated clients. */
export interface SafeContractDto {
  id: string;
  contractId: string;
  status: ContractStatus;
  templateId: string;
  serviceType: string;
  clientName: string;
  fields: readonly ContractTemplateField[];
  selectedServices: readonly ContractServiceSnapshot[];
  pricing: ContractPricingSnapshot;
  signatures: readonly SafeContractSignatureDto[];
  createdAt: string;
  updatedAt: string;
  totalAmount: number;
  depositAmount: number;
  signedAt?: string;
}
