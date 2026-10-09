import { Router } from 'express';
import { z } from 'zod';

import authMiddleware from '../../../middleware/authMiddleware';
import authorizeRoles from '../../../middleware/authorizeRoles';
import { ApiResponse } from '../../../utils/responseBuilder';
import { PostponementService } from '../application/postponementService';
import { POSTPONEMENT_REASONS } from '../domain/types';

export function createDoulaMessagingRoutes(
  postponements: PostponementService
): Router {
  const router = Router();
  router.use(authMiddleware);
  router.post(
    '/clients/:id/postponement-requests',
    (req, res, next) => authorizeRoles(req, res, next, ['doula']),
    async (req, res) => {
      const body = z
        .object({
          contract_id: z.string().uuid().nullable().optional(),
          reason_code: z.enum(POSTPONEMENT_REASONS),
          reason_note: z.string().nullable().optional(),
          restart_at: z.string().datetime().optional(),
        })
        .parse(req.body);
      const actorId = String(
        (req as { user?: { id?: string } }).user?.id || ''
      );
      const result = await postponements.create({
        clientId: req.params.id,
        contractId: body.contract_id,
        reasonCode: body.reason_code,
        reasonNote: body.reason_note,
        restartAt: body.restart_at ? new Date(body.restart_at) : null,
        actorId,
        asRequest: true,
      });
      res.status(201).json(ApiResponse.success(result));
    }
  );
  return router;
}
