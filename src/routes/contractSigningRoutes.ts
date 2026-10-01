import { Request, Response, Router } from 'express';

import { logger } from '../common/utils/logger';
import {
  toSafeClientErrorBody,
  toSafeProviderError,
} from '../common/utils/safeLogging';
import { nativeContracts } from '../config/env';
import { queryCloudSql } from '../db/cloudSqlPool';
import { normalizeContractPayload } from '../features/contracts/domain/normalization';
import authMiddleware from '../middleware/authMiddleware';
import authorizeRoles from '../middleware/authorizeRoles';

const router = Router();

const requireAdmin = (req: any, res: any, next: any) =>
  authorizeRoles(req, res, next, ['admin']);

router.use(authMiddleware);
router.use(requireAdmin);

/**
 * Create a native contract draft and send the signing invitation.
 * POST /api/contract-signing/generate-contract
 */
router.post(
  '/generate-contract',
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!nativeContracts.enabled) {
        res.status(503).json({
          success: false,
          error: 'Native contract creation is disabled',
        });
        return;
      }
      const normalized = normalizeContractPayload(req.body);
      if (!normalized.clientEmail || !normalized.clientName) {
        res.status(400).json({
          success: false,
          error: 'clientName and clientEmail are required',
        });
        return;
      }
      type ClientRow = {
        id: string;
        first_name: string | null;
        last_name: string | null;
        email: string;
      };
      const hasValidClientId =
        typeof normalized.clientId === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          normalized.clientId
        );
      const { rows } = hasValidClientId
        ? await queryCloudSql<ClientRow>(
            `SELECT id, first_name, last_name, email
             FROM public.phi_clients
             WHERE id = $1::uuid
             LIMIT 1`,
            [normalized.clientId]
          )
        : await queryCloudSql<ClientRow>(
            `SELECT id, first_name, last_name, email
             FROM public.phi_clients
             WHERE lower(email) = lower($1)
             LIMIT 1`,
            [normalized.clientEmail]
          );
      const client = rows[0];
      if (!client) {
        res.status(404).json({
          success: false,
          error: 'Client not found',
        });
        return;
      }
      const clientName =
        [client.first_name, client.last_name]
          .filter(Boolean)
          .join(' ')
          .trim() || normalized.clientName;
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const {
        nativeContractService,
      } = require('../features/contracts/composition');
      const draft = await nativeContractService.createLegacyDraft(
        {
          ...normalized,
          clientId: client.id,
          clientName,
          clientEmail: client.email,
        },
        String((req as any).user?.id || '')
      );
      const contract = await nativeContractService.send(
        draft.id,
        String((req as any).user?.id || '')
      );
      res.json({
        success: true,
        message: 'Contract generated and sent for signature',
        data: {
          success: true,
          contractId: contract.id,
          clientName,
          clientEmail: client.email,
          docxPath: '',
          pdfPath: '',
          signNow: {
            documentId: contract.id,
            invitationSent: true,
            status: 'invitation_sent',
          },
          emailDelivery: {
            provider: 'native',
            sent: true,
            message: 'Signing invitation sent',
          },
        },
      });
    } catch (error: unknown) {
      logger.error(
        toSafeProviderError('native_contracts', 'generate_contract', error),
        'Native contract generation workflow failed'
      );
      res
        .status(500)
        .json(toSafeClientErrorBody('Contract generation workflow failed'));
    }
  }
);

export default router;
