export const CLIENT_DOCUMENT_TYPE_INSURANCE_CARD = 'insurance_card';
export const CLIENT_DOCUMENT_CATEGORY_BILLING = 'billing';

export const MAX_CLIENT_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;

/** Must stay in sync with Supabase bucket `allowed_mime_types` (see ClientDocumentUploadService). */
export const CLIENT_DOCUMENT_BUCKET_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
] as const;

export const CLIENT_DOCUMENT_ALLOWED_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.pdf',
  '.webp',
  '.heic',
  '.heif',
] as const;
export const CLIENT_DOCUMENT_ALLOWED_MIME_TYPES = CLIENT_DOCUMENT_BUCKET_MIME_TYPES;

export const CLIENT_DOCUMENT_BUCKET = 'client-documents';
