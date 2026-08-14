import { Request, Response, Router } from 'express';

import { logger } from '../common/utils/logger';
import {
  toSafeClientErrorBody,
  toSafeProviderError,
} from '../common/utils/safeLogging';
import authMiddleware from '../middleware/authMiddleware';
import authorizeRoles from '../middleware/authorizeRoles';
import {
  ValidationError,
  calculatePostpartumContract,
  formatForSignNow,
} from '../services/postpartum/calculateContract';
import { signNowService } from '../services/signNowService';
import { PostpartumContractInput } from '../types/postpartum';

const router = Router();

const requireAdmin = (req: any, res: any, next: any) =>
  authorizeRoles(req, res, next, ['admin']);
router.use(authMiddleware);
router.use(requireAdmin);

router.post('/postpartum/calculate', async (req, res) => {
  try {
    const input = req.body as PostpartumContractInput;
    const amounts = calculatePostpartumContract(input);
    const signNowFields = formatForSignNow(input, amounts);

    res.json({
      success: true,
      amounts,
      fields: signNowFields,
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    } else {
      logger.error(
        toSafeProviderError('contracts', 'postpartum_calculate', error),
        'Contract calculation failed'
      );
      res.status(500).json({
        success: false,
        error: 'Failed to calculate contract amounts',
      });
    }
  }
});

router.post('/postpartum/send', (_req: Request, res: Response): void => {
  res.status(410).json({
    success: false,
    error: 'DocuSign has been disabled; use SignNow flows instead.',
  });
});

// Step 2: Send client signing invitation after admin fills fields
router.post(
  '/postpartum/send-client-invite',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { documentId, client } = req.body;

      if (!documentId || !client || !client.email || !client.name) {
        res.status(400).json({
          success: false,
          error:
            'Missing required fields: documentId, client.email, client.name',
        });
        return;
      }

      logger.info(
        { service: 'signnow', operation: 'send_client_invite' },
        'Sending client signing invitation'
      );

      // Send invitation to client as Recipient 1 (signer)
      const result = await signNowService.createInvitationClientPartner(
        documentId,
        client,
        undefined,
        {
          subject: 'Your Postpartum Care Contract',
          message:
            "Please review and sign your postpartum care contract. After signing, you'll be directed to make the deposit payment.",
          clientRole: 'Recipient 1', // Client signs as Recipient 1
        }
      );

      res.json({
        success: true,
        message: 'Client signing invitation sent successfully',
        client,
        documentId,
        signnow: result,
      });
    } catch (error: unknown) {
      logger.error(
        toSafeProviderError('signnow', 'send_client_invite', error),
        'Failed to send client invitation'
      );
      // Security bug fix (PR 3): remove stack / provider response details from client body.
      res
        .status(500)
        .json(toSafeClientErrorBody('Failed to send client invitation'));
    }
  }
);

export default router;
