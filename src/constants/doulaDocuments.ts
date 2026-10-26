import {
  OPTIONAL_DOULA_DOCUMENT_TYPES,
  REQUIRED_DOULA_DOCUMENT_TYPES,
  UPLOADABLE_DOULA_DOCUMENT_TYPES,
  isRequiredDocument,
} from '../features/doulas/domain/documentPolicy';

export {
  REQUIRED_DOULA_DOCUMENT_TYPES,
  OPTIONAL_DOULA_DOCUMENT_TYPES,
  UPLOADABLE_DOULA_DOCUMENT_TYPES,
} from '../features/doulas/domain/documentPolicy';
/**
 * Doula document types.
 * Activation requires every required type to be approved.
 * Retired types stay valid on existing rows. New uploads of those types are rejected.
 */

export type RequiredDoulaDocumentType =
  (typeof REQUIRED_DOULA_DOCUMENT_TYPES)[number];

export type OptionalDoulaDocumentType =
  (typeof OPTIONAL_DOULA_DOCUMENT_TYPES)[number];

export const RETIRED_DOULA_DOCUMENT_TYPES = ['background_check'] as const;

export type RetiredDoulaDocumentType =
  (typeof RETIRED_DOULA_DOCUMENT_TYPES)[number];

export type UploadableDoulaDocumentType =
  (typeof UPLOADABLE_DOULA_DOCUMENT_TYPES)[number];

export const ALL_DOULA_DOCUMENT_TYPES = [
  ...UPLOADABLE_DOULA_DOCUMENT_TYPES,
  ...RETIRED_DOULA_DOCUMENT_TYPES,
] as const;

export type DoulaDocumentType = (typeof ALL_DOULA_DOCUMENT_TYPES)[number];

export interface DoulaDocumentMeta {
  label: string;
  required: boolean;
  helperText?: string;
  multiple?: boolean;
  retired?: boolean;
}

const DOCUMENT_META: Record<
  DoulaDocumentType,
  Omit<DoulaDocumentMeta, 'required'>
> = {
  cpr: { label: 'CPR' },
  hipaa: { label: 'HIPAA' },
  training_certificate: {
    label: 'Doula training certificate',
  },
  liability_insurance_certificate: {
    label: 'Liability insurance',
    helperText: 'Required for Medicaid clients',
  },
  illinois_medicaid_certification: {
    label: 'Illinois Medicaid certification',
  },
  miscellaneous: {
    label: 'Miscellaneous documents',
    multiple: true,
  },
  license: {
    label: 'License',
  },
  other: {
    label: 'Other',
  },
  background_check: {
    label: 'Background check',
    retired: true,
  },
  w9: {
    label: 'W-9',
  },
  direct_deposit_form: {
    label: 'Direct deposit form',
  },
};

export const DOULA_DOCUMENT_META = Object.fromEntries(
  Object.entries(DOCUMENT_META).map(([type, meta]) => [
    type,
    { ...meta, required: isRequiredDocument(type) },
  ])
) as Record<DoulaDocumentType, DoulaDocumentMeta>;

export const DOULA_DOCUMENT_STATUSES = [
  'missing',
  'uploaded',
  'approved',
  'rejected',
] as const;

export type DoulaDocumentStatus = (typeof DOULA_DOCUMENT_STATUSES)[number];

export const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
];

export function isRequiredDocumentType(
  type: string
): type is RequiredDoulaDocumentType {
  return REQUIRED_DOULA_DOCUMENT_TYPES.includes(
    type as RequiredDoulaDocumentType
  );
}

export function isRetiredDoulaDocumentType(
  type: string
): type is RetiredDoulaDocumentType {
  return RETIRED_DOULA_DOCUMENT_TYPES.includes(
    type as RetiredDoulaDocumentType
  );
}

export function isUploadableDoulaDocumentType(
  type: string
): type is UploadableDoulaDocumentType {
  return UPLOADABLE_DOULA_DOCUMENT_TYPES.includes(
    type as UploadableDoulaDocumentType
  );
}

export function allowsMultipleDoulaDocuments(type: string): boolean {
  if (
    !isUploadableDoulaDocumentType(type) &&
    !isRetiredDoulaDocumentType(type)
  ) {
    return false;
  }
  return DOULA_DOCUMENT_META[type].multiple === true;
}

export function doulaDocumentUploadRejection(type: string): string | null {
  if (isRetiredDoulaDocumentType(type)) {
    return `${DOULA_DOCUMENT_META[type].label} uploads are no longer accepted.`;
  }
  if (!isUploadableDoulaDocumentType(type)) {
    return `Invalid document_type. Must be one of: ${UPLOADABLE_DOULA_DOCUMENT_TYPES.join(', ')}`;
  }
  return null;
}
