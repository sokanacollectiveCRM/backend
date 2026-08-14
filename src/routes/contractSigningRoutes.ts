import crypto from 'crypto';
import { Request, Response, Router } from 'express';

import { logger } from '../common/utils/logger';
import {
  SAFE_INTERNAL_ERROR_MESSAGE,
  toSafeClientErrorBody,
  toSafeProviderError,
} from '../common/utils/safeLogging';
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
      const contractData = req.body;

      // Validate required fields
      if (
        !contractData.clientName ||
        !contractData.clientEmail ||
        !contractData.totalInvestment ||
        !contractData.depositAmount
      ) {
        res.status(400).json({
          success: false,
          error:
            'clientName, clientEmail, totalInvestment, and depositAmount are required',
        });
        return;
      }

      // Generate contract ID if not provided
      const contractId = contractData.contractId || crypto.randomUUID();

      // Prepare contract data
      const finalContractData: SignNowContractData = {
        contractId,
        clientName: contractData.clientName,
        clientEmail: contractData.clientEmail,
        serviceType: contractData.serviceType || 'Postpartum Doula Services',
        totalInvestment: contractData.totalInvestment,
        depositAmount: contractData.depositAmount,
        remainingBalance:
          contractData.remainingBalance ||
          (
            parseFloat(contractData.totalInvestment.replace(/[$,]/g, '')) -
            parseFloat(contractData.depositAmount.replace(/[$,]/g, ''))
          ).toFixed(2),
        contractDate:
          contractData.contractDate || new Date().toLocaleDateString(),
        dueDate:
          contractData.dueDate ||
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0],
        startDate:
          contractData.startDate || new Date().toISOString().split('T')[0],
        endDate:
          contractData.endDate ||
          new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0],

        // Include Postpartum fields if they exist
        ...(contractData.totalHours && { totalHours: contractData.totalHours }),
        ...(contractData.hourlyRate && { hourlyRate: contractData.hourlyRate }),
        ...(contractData.overnightFee && {
          overnightFee: contractData.overnightFee,
        }),
      };

      logger.info(
        { service: 'signnow', operation: 'generate_contract' },
        'Starting complete contract workflow'
      );
      const result = await processContractWithSignNow(finalContractData);

      res.json({
        success: result.success,
        message: result.success
          ? `Contract generated and sent via SignNow to ${result.clientEmail}`
          : 'Contract generation failed',
        data: result,
      });
    } catch (error: unknown) {
      logger.error(
        toSafeProviderError('signnow', 'generate_contract', error),
        'Contract generation workflow failed'
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
