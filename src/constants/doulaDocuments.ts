/**
 * Mandatory doula document types and status constants.
 * A doula cannot be active unless all required documents are approved.
 */

export const REQUIRED_DOULA_DOCUMENT_TYPES = [
  'background_check',
  'liability_insurance_certificate',
  'training_certificate',
  'w9',
  'direct_deposit_form',
] as const;

export type RequiredDoulaDocumentType = (typeof REQUIRED_DOULA_DOCUMENT_TYPES)[number];

export const ALL_DOULA_DOCUMENT_TYPES = [
  ...REQUIRED_DOULA_DOCUMENT_TYPES,
  'license',
  'other',
] as const;

export type DoulaDocumentType = (typeof ALL_DOULA_DOCUMENT_TYPES)[number];

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

export function isRequiredDocumentType(type: string): type is RequiredDoulaDocumentType {
  return REQUIRED_DOULA_DOCUMENT_TYPES.includes(type as RequiredDoulaDocumentType);
}
