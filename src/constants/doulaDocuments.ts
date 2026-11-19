/**
 * Doula document types.
 * Activation requires every required type to be approved.
 * Retired types stay valid on existing rows. New uploads of those types are rejected.
 */

export const REQUIRED_DOULA_DOCUMENT_TYPES = ['training_certificate'] as const;

export type RequiredDoulaDocumentType =
  (typeof REQUIRED_DOULA_DOCUMENT_TYPES)[number];

export const OPTIONAL_DOULA_DOCUMENT_TYPES = [
  'liability_insurance_certificate',
  'illinois_medicaid_certification',
  'miscellaneous',
  'license',
  'other',
] as const;

export type OptionalDoulaDocumentType =
  (typeof OPTIONAL_DOULA_DOCUMENT_TYPES)[number];

export const RETIRED_DOULA_DOCUMENT_TYPES = [
  'background_check',
  'w9',
  'direct_deposit_form',
] as const;

export type RetiredDoulaDocumentType =
  (typeof RETIRED_DOULA_DOCUMENT_TYPES)[number];

export const UPLOADABLE_DOULA_DOCUMENT_TYPES = [
  ...REQUIRED_DOULA_DOCUMENT_TYPES,
  ...OPTIONAL_DOULA_DOCUMENT_TYPES,
] as const;

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

export const DOULA_DOCUMENT_META: Record<DoulaDocumentType, DoulaDocumentMeta> =
  {
    training_certificate: {
      label: 'Doula training certificate',
      required: true,
    },
    liability_insurance_certificate: {
      label: 'Liability insurance',
      required: false,
      helperText: 'Required for Medicaid clients',
    },
    illinois_medicaid_certification: {
      label: 'Illinois Medicaid certification',
      required: false,
    },
    miscellaneous: {
      label: 'Miscellaneous documents',
      required: false,
      multiple: true,
    },
    license: {
      label: 'License',
      required: false,
    },
    other: {
      label: 'Other',
      required: false,
    },
    background_check: {
      label: 'Background check',
      required: false,
      retired: true,
    },
    w9: {
      label: 'W9',
      required: false,
      retired: true,
    },
    direct_deposit_form: {
      label: 'Direct deposit form',
      required: false,
      retired: true,
    },
  };

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
