export const CLIENT_DOCUMENT_TYPE_INSURANCE_CARD = 'insurance_card';
export const CLIENT_DOCUMENT_CATEGORY_BILLING = 'billing';

export const MAX_CLIENT_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;

export const CLIENT_DOCUMENT_ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.pdf'] as const;
export const CLIENT_DOCUMENT_ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf'] as const;

export const CLIENT_DOCUMENT_BUCKET = 'client-documents';
