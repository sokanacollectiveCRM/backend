import { Request, Response, Router } from 'express';
import { SignNowService } from '../services/signNowService';
import { checkSignNowDocumentStatus, processContractWithSignNow, type SignNowContractData } from '../utils/signNowContractProcessor';

const router = Router();

interface ContractSigningRequest extends Request {
  body: SignNowContractData;
}

/**
 * Complete contract generation and signature workflow
 * POST /api/contract-signing/generate-and-send
 */
router.post('/generate-and-send', async (req: ContractSigningRequest, res: Response): Promise<void> => {
  try {
    const contractData = req.body;

    // Validate required fields
    if (!contractData.contractId || !contractData.clientName || !contractData.clientEmail) {
      res.status(400).json({
        success: false,
        error: 'contractId, clientName, and clientEmail are required'
      });
      return;
    }

    console.log(`🚀 Starting SignNow-only workflow for contract ${contractData.contractId}`);

    // Process contract with SignNow (no nodemailer)
    const result = await processContractWithSignNow(contractData);

    if (result.success) {
      res.json({
        success: true,
        message: `Contract generated and sent via SignNow to ${result.clientEmail}`,
        data: result
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.emailDelivery.message,
        data: result
      });
    }

  } catch (error: any) {
    console.error('❌ SignNow workflow failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'SignNow workflow failed',
      details: error.stack
    });
  }
});

/**
 * POST /api/contract-signing/get-field-coordinates
 * Get field coordinates from a SignNow document
 */
router.post('/get-field-coordinates', async (req: Request, res: Response): Promise<void> => {
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
      message: 'Field coordinates retrieved successfully'
    });

  } catch (error: any) {
    console.error('Error getting field coordinates:', error);
    res.status(500).json({
      error: 'Failed to get field coordinates',
      details: error.message
    });
  }
});

/**
 * Quick test endpoint to send a sample contract
 * POST /api/contract-signing/test-send
 */
router.post('/test-send', async (_req: Request, res: Response): Promise<void> => {
  try {
    const contractId = `test-${Date.now()}`;

    // Use the new SignNow processor for test
    const testContractData: SignNowContractData = {
      contractId,
      clientName: 'Jerry Bony',
      clientEmail: 'jerrybony5@gmail.com',
      serviceType: 'Postpartum Doula Services',
      totalInvestment: '$1,200.00',
      depositAmount: '$600.00',
      remainingBalance: '$600.00',
      contractDate: new Date().toLocaleDateString(),
      dueDate: '2024-04-15',
      startDate: '2024-03-01',
      endDate: '2024-05-01'
    };

    console.log(`🧪 Testing SignNow workflow for ${contractId}`);
    const result = await processContractWithSignNow(testContractData);

    res.json({
      success: result.success,
      message: result.success
        ? `Test contract processed via SignNow for ${result.clientName}`
        : `Test failed: ${result.emailDelivery.message}`,
      data: result
    });

  } catch (error: any) {
    console.error('❌ Test workflow failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Test workflow failed',
      details: error.response?.data || error.stack
    });
  }
});

/**
 * Check status of a SignNow document
 * GET /api/contract-signing/status/:documentId
 */
router.get('/status/:documentId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { documentId } = req.params;
    const result = await checkSignNowDocumentStatus(documentId);

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }

  } catch (error: any) {
    console.error('❌ Failed to check document status:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to check document status'
    });
  }
});

export default router;
