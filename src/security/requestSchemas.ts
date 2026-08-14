/**
 * Shared Zod request schemas for incrementally migrated routes (PR 7).
 */

import { z } from 'zod';

export const loginBodySchema = z.object({
  email: z.string().trim().email('Valid email is required'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginBodyInput = z.infer<typeof loginBodySchema>;
