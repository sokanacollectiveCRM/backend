/**
 * Public email feature API.
 * Mount stays `/email`. The old controller and route paths are shims.
 * Shared mail transport remains `src/services/emailService`.
 */

export { EmailController } from './http/emailController';
export { default as emailRoutes } from './http/EmailRoutes';
