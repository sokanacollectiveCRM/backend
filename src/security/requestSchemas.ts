/**
 * Shared Zod request schemas for incrementally migrated routes (PR 7).
 */
import { z } from 'zod';

export const loginBodySchema = z.object({
  email: z.string().trim().email('Valid email is required'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginBodyInput = z.infer<typeof loginBodySchema>;

export const identitySessionBodySchema = z.object({
  idToken: z.string().min(1, 'idToken is required'),
});

export const identityMfaVerifyBodySchema = z.object({
  challengeId: z.string().uuid('challengeId must be a UUID'),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'code must be a 6-digit number'),
  idToken: z.string().min(1, 'idToken is required'),
});

export const identityMfaResendBodySchema = z.object({
  challengeId: z.string().uuid('challengeId must be a UUID'),
  idToken: z.string().min(1, 'idToken is required'),
});
