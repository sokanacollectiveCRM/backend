import express, { Request, Response } from 'express';

import authMiddleware from '../middleware/authMiddleware';
import authorizeRoles from '../middleware/authorizeRoles';
import { IS_PRODUCTION } from '../config/env';

import {
  getAvailableContractTemplates,
  processContractWithPdfTemplate,
  validateContractDataForTemplate,
} from '../utils/pdfContractProcessor';

const router = express.Router();

router.use(
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin'])
);

const getSignNowAccessToken = (): string | undefined => {
  const token = process.env.SIGNNOW_ACCESS_TOKEN;
  return typeof token === 'string' && token.trim() ? token.trim() : undefined;
};

interface PdfContractRequest extends Request {
  body: {
    contractId: string;
    clientName: string;
    clientEmail: string;
    templateKey: string;
    [key: string]: any;
  };
}

/**
 * POST /api/pdf-contract/process
 * Process a contract using PDF templates with fixed coordinates
 */
router.post(
  '/process',
  async (req: PdfContractRequest, res: Response): Promise<void> => {
    try {
      const {
        contractId,
        clientName,
        clientEmail,
        templateKey,
        ...contractData
      } = req.body;

      // Validate required fields
      if (!contractId || !clientName || !clientEmail || !templateKey) {
        res.status(400).json({
          success: false,
          error:
            'Missing required fields: contractId, clientName, clientEmail, templateKey',
        });
        return;
      }

      // Validate template exists
      const availableTemplates = getAvailableContractTemplates();
      if (!availableTemplates.includes(templateKey)) {
        res.status(400).json({
          success: false,
          error: `Template "${templateKey}" not found. Available templates: ${availableTemplates.join(', ')}`,
        });
        return;
      }

      // Validate contract data
      const validation = validateContractDataForTemplate(
        templateKey,
        contractData
      );
      if (!validation.valid) {
        res.status(400).json({
          success: false,
          error: `Missing required fields: ${validation.missingFields.join(', ')}`,
          missingFields: validation.missingFields,
        });
        return;
      }

      const signNowToken = getSignNowAccessToken();
      if (!signNowToken) {
        res.status(503).json({
          success: false,
          error: 'Contract signing provider is unavailable',
        });
        return;
      }

      // Process the contract
      const result = await processContractWithPdfTemplate(
        {
          contractId,
          clientName,
          clientEmail,
          templateKey,
          ...contractData,
        },
        signNowToken
      );

      res.json({
        success: true,
        message: 'Contract processed successfully',
        data: result,
      });
    } catch (error: any) {
      console.error('Error processing PDF contract:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to process contract',
      });
    }
  }
);

/**
 * GET /api/pdf-contract/templates
 * Get available contract templates
 */
router.get('/templates', async (req: Request, res: Response): Promise<void> => {
  try {
    const templates = getAvailableContractTemplates();

    res.json({
      success: true,
      templates: templates.map((template) => ({
        key: template,
        name: template.replace(/_/g, ' ').replace(/v\d+/g, '').trim(),
        description: `PDF template for ${template.replace(/_/g, ' ')}`,
      })),
    });
  } catch (error: any) {
    console.error('Error getting templates:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get templates',
    });
  }
});

/**
 * POST /api/pdf-contract/validate
 * Validate contract data for a specific template
 */
router.post('/validate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { templateKey, contractData } = req.body;

    if (!templateKey || !contractData) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: templateKey, contractData',
      });
      return;
    }

    const validation = validateContractDataForTemplate(
      templateKey,
      contractData
    );

    res.json({
      success: true,
      validation: {
        valid: validation.valid,
        missingFields: validation.missingFields,
      },
    });
  } catch (error: any) {
    console.error('Error validating contract data:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to validate contract data',
    });
  }
});

/**
 * POST /api/pdf-contract/test
 * Test endpoint for contract processing with sample data
 */
router.post('/test', async (req: Request, res: Response): Promise<void> => {
  try {
    if (IS_PRODUCTION) {
      res.status(404).json({ success: false, error: 'Not found' });
      return;
    }

    const { templateKey = 'labor_support_v1' } = req.body;

    // Sample contract data
    const sampleContractData = {
      contractId: `test-contract-${Date.now()}`,
      clientName: 'Test Client',
      clientEmail: 'test@example.com',
      templateKey,
      totalAmount: '2400.00',
      deposit: '400.00',
      balanceAmount: '2000.00',
      clientInitials: 'TC',
      client_signed_date: new Date().toLocaleDateString(),
    };

    const signNowToken = getSignNowAccessToken();
    if (!signNowToken) {
      res.status(503).json({
        success: false,
        error: 'Contract signing provider is unavailable',
      });
      return;
    }

    // Process the test contract
    const result = await processContractWithPdfTemplate(
      sampleContractData,
      signNowToken
    );

    res.json({
      success: true,
      message: 'Test contract processed successfully',
      data: result,
    });
  } catch (error: any) {
    console.error('Error processing test contract:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process test contract',
    });
  }
});

export default router;





