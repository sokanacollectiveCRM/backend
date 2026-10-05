import { Request, Response, Router } from 'express';

import { logger } from '../../../common/utils/logger';
import { toSafeProviderError } from '../../../common/utils/safeLogging';
import authMiddleware from '../../../middleware/authMiddleware';
import authorizeRoles from '../../../middleware/authorizeRoles';
import {
  ValidationError,
  calculatePostpartumContract,
  formatPostpartumFields,
} from '../../../services/postpartum/calculateContract';
import { PostpartumContractInput } from '../../../types/postpartum';

const router = Router();

const requireAdmin = (req: any, res: any, next: any) =>
  authorizeRoles(req, res, next, ['admin']);
router.use(authMiddleware);
router.use(requireAdmin);

router.post('/postpartum/calculate', async (req, res) => {
  try {
    const input = req.body as PostpartumContractInput;
    const amounts = calculatePostpartumContract(input);
    const fields = formatPostpartumFields(input, amounts);

    res.json({
      success: true,
      amounts,
      fields,
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
    error: 'Use the native contract signing flow.',
  });
});

export default router;
