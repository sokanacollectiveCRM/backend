import { z } from 'zod';
import { ALL_DOULA_DOCUMENT_TYPES } from '../../constants/doulaDocuments';

export const MAX_DOULA_DOCUMENT_FILE_NAME_LENGTH = 255;

export const renameDoulaDocumentSchema = z.object({
  file_name: z.string({
    invalid_type_error: 'file_name must be a string',
  })
    .trim()
    .min(1, 'file_name cannot be empty')
    .max(MAX_DOULA_DOCUMENT_FILE_NAME_LENGTH, `file_name must be ${MAX_DOULA_DOCUMENT_FILE_NAME_LENGTH} characters or fewer`)
    .refine((value) => !/[\\/]/.test(value), 'file_name cannot contain "/" or "\\"')
    .refine((value) => !value.includes('..'), 'file_name cannot contain ".."')
    .refine((value) => !/[\u0000-\u001f]/.test(value), 'file_name contains invalid characters')
    .optional(),
  document_type: z.enum(ALL_DOULA_DOCUMENT_TYPES, {
    errorMap: () => ({ message: `document_type must be one of: ${ALL_DOULA_DOCUMENT_TYPES.join(', ')}` }),
  }).optional(),
}).refine(
  (data) => typeof data.file_name === 'string' || typeof data.document_type === 'string',
  { message: 'At least one of file_name or document_type is required' }
);

export type RenameDoulaDocumentRequestDTO = z.infer<typeof renameDoulaDocumentSchema>;
