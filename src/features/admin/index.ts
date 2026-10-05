/**
 * Public admin feature API.
 * Mount stays `/api/admin`. The old controller and route paths are shims.
 */

export { AdminController } from './http/adminController';
export { default as adminRoutes } from './http/adminRoutes';
