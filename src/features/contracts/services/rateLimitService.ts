/**
 * Compatibility shim — rate-limit rules live in `application/`; the Cloud SQL
 * store lives in `infrastructure/`.
 */
export * from '../application/rateLimitService';
export { PostgresRateLimitStore } from '../infrastructure/postgresRateLimitStore';
