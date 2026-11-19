import { NextFunction, Request, Response, Router } from 'express';

import authMiddleware from '../../../middleware/authMiddleware';
import authorizeRoles from '../../../middleware/authorizeRoles';
import { ContractController } from './contractController';

function safeError(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const candidate = error as { statusCode?: number; message?: string };
  const status =
    typeof candidate?.statusCode === 'number' ? candidate.statusCode : 500;
  res.status(status).json({
    error: status >= 500 ? 'Internal server error' : candidate.message,
  });
}

export function createClientContractRoutes(
  controller: ContractController
): Router {
  const router = Router();
  const requireClient = (
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    void authorizeRoles(req, res, next, ['client']);
  };

  // Middleware must stay on these routes only. A router-level client check
  // 403s admins on every later /api/clients/* mount (documents, activities).
  router.get(
    '/me/contracts',
    authMiddleware,
    requireClient,
    controller.listMine
  );
  router.get(
    '/me/contracts/:id',
    authMiddleware,
    requireClient,
    controller.getMine
  );
  router.get(
    '/me/contracts/:id/download',
    authMiddleware,
    requireClient,
    controller.downloadMine
  );
  router.use(safeError);
  return router;
}
