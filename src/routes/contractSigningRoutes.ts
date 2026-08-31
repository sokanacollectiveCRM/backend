import { Request, Response, Router } from 'express';

import { logger } from '../common/utils/logger';
import {
  SAFE_INTERNAL_ERROR_MESSAGE,
  toSafeClientErrorBody,
  toSafeProviderError,
} from '../common/utils/safeLogging';
import { nativeContracts } from '../config/env';
import { queryCloudSql } from '../db/cloudSqlPool';
import { normalizeContractPayload } from '../features/contracts/domain/normalization';
import authMiddleware from '../middleware/authMiddleware';
import authorizeRoles from '../middleware/authorizeRoles';
import { SignNowService } from '../services/signNowService';
import {
  type SignNowContractData,
  checkSignNowDocumentStatus,
  processContractWithSignNow,
} from '../utils/signNowContractProcessor';

const router = Router();

const requireAdmin = (req: any, res: any, next: any) =>
  authorizeRoles(req, res, next, ['admin']);

// Security bug fix (PR 4): contract signing tooling requires admin session.
router.use(authMiddleware);
router.use(requireAdmin);
router.use((req, res, next) => {
  if (req.path !== '/generate-contract') {
    res.setHeader('Deprecation', 'true');
    res.setHeader('Link', '</api/contracts/drafts>; rel="successor-version"');
  }
  next();
});

interface ContractSigningRequest extends Request {
  body: SignNowContractData;
}

/**
 * Test SignNow authentication
 * GET /api/contract-signing/test-auth
 */
router.get('/test-auth', async (req: Request, res: Response): Promise<void> => {
  try {
    logger.info(
      { service: 'signnow', operation: 'test_auth' },
      'Testing SignNow authentication'
    );
    const signNowService = new SignNowService();
    const result = await signNowService.testAuthentication();

    res.json({
      success: true,
      message: 'SignNow authentication successful',
      data: result,
    });
  } catch (error: unknown) {
    logger.error(
      toSafeProviderError('signnow', 'test_auth', error),
      'SignNow authentication failed'
    );
    // Security bug fix (PR 3): remove stack / provider payload from client response.
    res
      .status(500)
      .json(toSafeClientErrorBody('SignNow authentication failed'));
  }
});

/**
 * Complete contract generation and signature workflow
 * POST /api/contract-signing/generate-and-send
 */
router.post(
  '/generate-and-send',
  async (req: ContractSigningRequest, res: Response): Promise<void> => {
    try {
      const contractData = req.body;

      // Validate required fields
      if (
        !contractData.contractId ||
        !contractData.clientName ||
        !contractData.clientEmail
      ) {
        res.status(400).json({
          success: false,
          error: 'contractId, clientName, and clientEmail are required',
        });
        return;
      }

      logger.info(
        { service: 'signnow', operation: 'generate_and_send' },
        'Starting SignNow contract workflow'
      );

      // Process contract with SignNow (no nodemailer)
      const result = await processContractWithSignNow(contractData);

      if (result.success) {
        res.json({
          success: true,
          message: `Contract generated and sent via SignNow to ${result.clientEmail}`,
          data: result,
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Contract generation or delivery failed',
          data: result,
        });
      }
    } catch (error: unknown) {
      logger.error(
        toSafeProviderError('signnow', 'generate_and_send', error),
        'SignNow workflow failed'
      );
      // Security bug fix (PR 3): remove stack from client response.
      res.status(500).json(toSafeClientErrorBody('SignNow workflow failed'));
    }
  }
);

/**
 * POST /api/contract-signing/get-field-coordinates
 * Get field coordinates from a SignNow document
 */
router.post(
  '/get-field-coordinates',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { documentId } = req.body;

      if (!documentId) {
        res.status(400).json({ error: 'documentId is required' });
        return;
      }

      const signNowService = new SignNowService();
      const fields = await signNowService.getDocumentFields(documentId);

      res.json({
        success: true,
        documentId,
        fields,
        message: 'Field coordinates retrieved successfully',
      });
    } catch (error: unknown) {
      logger.error(
        toSafeProviderError('signnow', 'get_field_coordinates', error),
        'Field coordinates lookup failed'
      );
      // Security bug fix (PR 3): remove raw error.message details from client response.
      res.status(500).json({
        error: 'Failed to get field coordinates',
      });
    }
  }
);

/**
 * Generate contract with payment tracking and send invitation
 * POST /api/contract-signing/generate-contract
 */
router.post(
  '/generate-contract',
  async (req: ContractSigningRequest, res: Response): Promise<void> => {
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
      // Lazily compose only on the enabled native path.
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
            documentId: '',
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
      return;
    } catch (error: unknown) {
      logger.error(
        toSafeProviderError('native_contracts', 'generate_contract', error),
        'Native contract generation workflow failed'
      );
      // Security bug fix (PR 3): remove stack / provider payload from client response.
      res
        .status(500)
        .json(toSafeClientErrorBody('Contract generation workflow failed'));
    }
  }
);

/**
 * Check status of a SignNow document
 * GET /api/contract-signing/status/:documentId
 */
router.get(
  '/status/:documentId',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { documentId } = req.params;
      const result = await checkSignNowDocumentStatus(documentId);

      if (result.success) {
        res.json(result);
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to check document status',
        });
      }
    } catch (error: unknown) {
      logger.error(
        toSafeProviderError('signnow', 'document_status', error),
        'Document status check failed'
      );
      res
        .status(500)
        .json(toSafeClientErrorBody('Failed to check document status'));
    }
  }
);

export default router;
