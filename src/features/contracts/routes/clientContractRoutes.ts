import { NextFunction, Request, Response, Router } from 'express';

import authMiddleware from '../../../middleware/authMiddleware';
import authorizeRoles from '../../../middleware/authorizeRoles';
import { ContractController } from '../controllers/contractController';

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
  router.use(authMiddleware);
  router.use((req, res, next) => authorizeRoles(req, res, next, ['client']));

  router.get('/me/contracts', controller.listMine);
  router.get('/me/contracts/:id', controller.getMine);
  router.get('/me/contracts/:id/download', controller.downloadMine);
  router.use(safeError);
  return router;
}
