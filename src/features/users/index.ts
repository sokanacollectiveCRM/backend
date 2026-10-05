/**
 * Public users feature API.
 * Mounts stay `/users`. The old controller, use case, and route paths are shims.
 */

export { UserController } from './http/userController';
export { UserUseCase } from './application/userUseCase';
export { default as userRoutes } from './http/specificUserRoutes';
