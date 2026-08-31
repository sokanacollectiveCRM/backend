import { z } from 'zod';

import { nativeContracts } from '../../../config/env';

const MAX_SIGNATURE_DATA_URI_LENGTH =
  Math.ceil((nativeContracts.drawnSignatureMaxBytes * 4) / 3) + 64;
const idPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const moneyStringPattern = /^\$?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/;
const base64ImageDataUriPattern =
  /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/;

export const boundedIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(idPattern, 'Invalid ID');

export const moneyInputSchema = z.union([
  z.number().finite().nonnegative().max(100_000_000),
  z.string().trim().min(1).max(32).regex(moneyStringPattern),
]);

export const normalizedCoordinatesSchema = z
  .object({
    x: z.number().finite().min(0).max(1),
    y: z.number().finite().min(0).max(1),
    width: z.number().finite().positive().max(1),
    height: z.number().finite().positive().max(1),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.x + value.width > 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['width'],
        message: 'x + width must not exceed 1',
      });
    }
    if (value.y + value.height > 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['height'],
        message: 'y + height must not exceed 1',
      });
    }
  });

export const contractTemplateFieldSchema = z
  .object({
    id: boundedIdSchema,
    type: z.enum([
      'initials',
      'signature',
      'signing_date',
      'acknowledgment',
      'optional_text',
    ]),
    page: z.number().int().min(1).max(10_000),
    coordinates: normalizedCoordinatesSchema,
    label: z.string().trim().min(1).max(200).optional(),
    required: z.boolean(),
  })
  .strict();

const flatServiceSchema = z
  .object({
    id: boundedIdSchema,
    name: z.string().trim().min(1).max(200),
    type: z.literal('flat'),
    amount: moneyInputSchema,
  })
  .strict();

const hourlyServiceSchema = z
  .object({
    id: boundedIdSchema,
    name: z.string().trim().min(1).max(200),
    type: z.literal('hourly'),
    hourlyRate: moneyInputSchema,
    totalHours: z.coerce.number().finite().positive().max(100_000),
  })
  .strict();

export const contractServiceInputSchema = z.discriminatedUnion('type', [
  flatServiceSchema,
  hourlyServiceSchema,
]);

export const depositInputSchema = z
  .object({
    type: z.enum(['percent', 'flat']),
    value: moneyInputSchema,
  })
  .strict()
  .superRefine((deposit, context) => {
    if (
      deposit.type === 'percent' &&
      Number(String(deposit.value).replace(/[$,]/g, '')) > 100
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: 'Percent deposit must not exceed 100',
      });
    }
  });

export const adminDraftBodySchema = z
  .object({
    templateId: boundedIdSchema,
    clientId: boundedIdSchema,
    clientName: z.string().trim().min(1).max(200),
    clientEmail: z.string().trim().email().max(320),
    serviceType: z.string().trim().min(1).max(200),
    selectedServices: z.array(contractServiceInputSchema).max(50).default([]),
    adminFeeAmount: moneyInputSchema.optional(),
    deposit: depositInputSchema.optional(),
    installmentsCount: z.number().int().min(1).max(60).optional(),
    note: z.string().trim().max(2_000).optional(),
  })
  .strict();

export const adminSendBodySchema = z
  .object({
    subject: z.string().trim().min(1).max(200).optional(),
    message: z.string().trim().max(5_000).optional(),
  })
  .strict();

export const adminResendBodySchema = z
  .object({
    message: z.string().trim().max(5_000).optional(),
  })
  .strict();

export const adminVoidBodySchema = z
  .object({
    reason: z.string().trim().min(1).max(1_000),
  })
  .strict();

export const typedSignatureSchema = z
  .object({
    type: z.literal('typed'),
    text: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .refine(
        (value) => Buffer.byteLength(value, 'utf8') <= 512,
        'Typed signature exceeds the byte limit'
      ),
    fontFamily: z.string().trim().min(1).max(100).optional(),
  })
  .strict();

export const drawnSignatureSchema = z
  .object({
    type: z.literal('drawn'),
    dataUrl: z
      .string()
      .min(1)
      .max(MAX_SIGNATURE_DATA_URI_LENGTH)
      .regex(base64ImageDataUriPattern, 'Invalid PNG data URI')
      .refine((value) => {
        const encoded = value.slice(value.indexOf(',') + 1);
        return (
          Buffer.byteLength(encoded, 'base64') <=
          nativeContracts.drawnSignatureMaxBytes
        );
      }, 'Drawn signature exceeds the configured size limit'),
  })
  .strict();

export const signatureValueSchema = z.discriminatedUnion('type', [
  typedSignatureSchema,
  drawnSignatureSchema,
]);

const initialsSchema = z
  .string()
  .trim()
  .min(1)
  .max(16)
  .refine(
    (value) => Buffer.byteLength(value, 'utf8') <= 64,
    'Initials exceed the byte limit'
  );
const fieldIdArraySchema = z
  .array(boundedIdSchema)
  .max(500)
  .refine(
    (ids) => new Set(ids).size === ids.length,
    'Field IDs must be unique'
  );

export const signingProgressBodySchema = z
  .object({
    completedFieldIds: fieldIdArraySchema,
  })
  .strict();

export const signingCompleteBodySchema = z
  .object({
    signature: signatureValueSchema,
    consent: z.literal(true),
    initials: initialsSchema,
    completedFieldIds: fieldIdArraySchema,
  })
  .strict();

export const adminContractDraftSchema = adminDraftBodySchema;
export const adminContractSendSchema = adminSendBodySchema;
export const adminContractResendSchema = adminResendBodySchema;
export const adminContractVoidSchema = adminVoidBodySchema;
export const signingProgressSchema = signingProgressBodySchema;
export const signingCompleteSchema = signingCompleteBodySchema;

export type AdminDraftInput = z.infer<typeof adminDraftBodySchema>;
export type AdminSendInput = z.infer<typeof adminSendBodySchema>;
export type AdminResendInput = z.infer<typeof adminResendBodySchema>;
export type AdminVoidInput = z.infer<typeof adminVoidBodySchema>;
export type SigningProgressInput = z.infer<typeof signingProgressBodySchema>;
export type SigningCompleteInput = z.infer<typeof signingCompleteBodySchema>;
