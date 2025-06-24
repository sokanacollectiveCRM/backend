import { Router } from 'express';
import { z } from 'zod';
import { paymentController } from '../controllers/paymentController';
import authMiddleware from '../middleware/authMiddleware';
import { validateRequest } from '../middleware/validateRequest';

const router = Router();

// Validation schemas
const saveCardSchema = z.object({
  cardToken: z.string(),
});

const chargeCardSchema = z.object({
  amount: z.number().positive(),
  description: z.string().optional(),
});

const updateCardSchema = z.object({
  cardToken: z.string(),
});

// All payment routes should be authenticated
router.use(authMiddleware);

// Save a new card
router.post(
  '/customers/:customerId/cards',
  validateRequest(saveCardSchema),
  paymentController.saveCard.bind(paymentController)
);

// Update an existing card
router.put(
  '/customers/:customerId/cards/:paymentMethodId',
  validateRequest(updateCardSchema),
  paymentController.updatePaymentMethod.bind(paymentController)
);

// Process a charge
router.post(
  '/customers/:customerId/charge',
  validateRequest(chargeCardSchema),
  paymentController.processCharge.bind(paymentController)
);

// Get stored payment methods for a customer
router.get(
  '/customers/:customerId/cards',
  paymentController.getPaymentMethods.bind(paymentController)
);

// Get all customers with Stripe IDs
router.get(
  '/customers',
  paymentController.getCustomersWithStripeId.bind(paymentController)
);

export default router; 