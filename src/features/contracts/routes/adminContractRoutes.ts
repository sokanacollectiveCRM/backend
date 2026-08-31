import { NextFunction, Request, Response, Router } from 'express';
import { ZodError } from 'zod';

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
    error instanceof ZodError
      ? 400
      : typeof candidate?.statusCode === 'number'
        ? candidate.statusCode
        : 500;
  res.status(status).json({
    error: status >= 500 ? 'Internal server error' : candidate.message,
  });
}

export function createAdminContractRoutes(
  controller: ContractController
): Router {
  const router = Router();
  router.use(authMiddleware);
  router.use((req, res, next) => authorizeRoles(req, res, next, ['admin']));

  router.post('/drafts', controller.createDraft);
  router.get('/:id', controller.getAdmin);
  router.post('/:id/send', controller.send);
  router.post('/:id/resend', controller.resend);
  router.post('/:id/void', controller.void);
  router.get('/:id/audit', controller.audit);
  router.get('/:id/download', controller.downloadAdmin);
  router.use(safeError);
  return router;
}
