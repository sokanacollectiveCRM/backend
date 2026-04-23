import express from 'express';
import { z } from 'zod';
import authMiddleware from '../middleware/authMiddleware';
import authorizeRoles from '../middleware/authorizeRoles';
import { paymentMethodController } from '../controllers/paymentMethodController';

const router = express.Router();

const savePaymentMethodSchema = z.object({
  client_id: z.string().uuid(),
  intuit_token: z.string().min(1),
  request_id: z.string().min(1),
});

router.use(authMiddleware);

router.post(
  '/',
  (req, res, next) => authorizeRoles(req, res, next, ['admin', 'doula', 'client']),
  (req, res, next) => {
    const parsed = savePaymentMethodSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid payment method request',
        code: 'validation_error',
        details: parsed.error.flatten(),
      });
      return;
    }
    req.body = parsed.data;
    next();
  },
  (req, res) => paymentMethodController.savePaymentMethod(req, res)
);

router.get(
  '/:clientId',
  (req, res, next) => authorizeRoles(req, res, next, ['admin', 'doula', 'client']),
  (req, res) => paymentMethodController.getPaymentMethod(req, res)
);

export default router;
