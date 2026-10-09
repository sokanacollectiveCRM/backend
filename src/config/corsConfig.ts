import type { CorsOptions } from 'cors';

/** Browser preflight allowlist. Public intake sends optional `Idempotency-Key`. */
export const CORS_ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'X-Session-Token',
  'X-Signing-Session',
  'Idempotency-Key',
] as const;

export function createCorsOptions(allowedOrigins: Set<string>): CorsOptions {
  return {
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void
    ) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [...CORS_ALLOWED_HEADERS],
    credentials: true, // Required for HttpOnly sokana_session_token cookie cross-origin
    maxAge: 86400,
  };
}
