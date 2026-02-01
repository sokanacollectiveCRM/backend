import { Request, Response, Router } from 'express';
import { calculatePostpartumContract, formatForSignNow, ValidationError } from '../services/postpartum/calculateContract';
import { signNowService } from '../services/signNowService';
import { PostpartumContractInput } from '../types/postpartum';

const router = Router();

router.post('/postpartum/calculate', async (req, res) => {
  try {
    const input = req.body as PostpartumContractInput;
    const amounts = calculatePostpartumContract(input);
    const signNowFields = formatForSignNow(input, amounts);

    res.json({
      success: true,
      amounts,
      fields: signNowFields
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    } else {
      console.error('Contract calculation failed:', error);
    res.status(500).json({
      success: false,
        error: 'Failed to calculate contract amounts'
      });
    }
  }
});

router.post('/postpartum/send', (_req: Request, res: Response): void => {
  res.status(410).json({
    success: false,
    error: 'DocuSign has been disabled; use SignNow flows instead.'
  });
});

// Step 2: Send client signing invitation after admin fills fields
router.post('/postpartum/send-client-invite', async (req: Request, res: Response): Promise<void> => {
  try {
    const { documentId, client } = req.body;

    if (!documentId || !client || !client.email || !client.name) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: documentId, client.email, client.name'
      });
    }

    console.log('📤 Sending client signing invitation...');

    // Send invitation to client as Recipient 1 (signer)
    const result = await signNowService.createInvitationClientPartner(
      documentId,
      client,
      undefined,
      {
        subject: "Your Postpartum Care Contract",
        message: "Please review and sign your postpartum care contract. After signing, you'll be directed to make the deposit payment.",
        clientRole: 'Recipient 1' // Client signs as Recipient 1
      }
    );

    res.json({
      success: true,
      message: 'Client signing invitation sent successfully',
      client,
      documentId,
      signnow: result
    });

  } catch (error) {
    console.error('Failed to send client invitation:', {
      error: error.message,
      response: error.response?.data,
      stack: error.stack,
      config: error.config
    });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send client invitation',
      details: error.response?.data
    });
  }
});

export default router;
