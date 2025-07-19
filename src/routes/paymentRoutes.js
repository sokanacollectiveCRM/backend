'use strict';
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
const express_1 = require('express');
const zod_1 = require('zod');
const paymentController_1 = require('../controllers/paymentController');
const authMiddleware_1 = __importDefault(
  require('../middleware/authMiddleware')
);
const validateRequest_1 = require('../middleware/validateRequest');
const router = (0, express_1.Router)();
// Validation schemas
const saveCardSchema = zod_1.z.object({
  cardToken: zod_1.z.string(),
});
const chargeCardSchema = zod_1.z.object({
  amount: zod_1.z.number().positive(),
  description: zod_1.z.string().optional(),
});
const updateCardSchema = zod_1.z.object({
  cardToken: zod_1.z.string(),
});
// All payment routes should be authenticated
router.use(authMiddleware_1.default);
// Save a new card
router.post(
  '/customers/:customerId/cards',
  (0, validateRequest_1.validateRequest)(saveCardSchema),
  paymentController_1.paymentController.saveCard.bind(
    paymentController_1.paymentController
  )
);
// Update an existing card
router.put(
  '/customers/:customerId/cards/:paymentMethodId',
  (0, validateRequest_1.validateRequest)(updateCardSchema),
  paymentController_1.paymentController.updatePaymentMethod.bind(
    paymentController_1.paymentController
  )
);
// Process a charge
router.post(
  '/customers/:customerId/charge',
  (0, validateRequest_1.validateRequest)(chargeCardSchema),
  paymentController_1.paymentController.processCharge.bind(
    paymentController_1.paymentController
  )
);
// Get stored payment methods for a customer
router.get(
  '/customers/:customerId/cards',
  paymentController_1.paymentController.getPaymentMethods.bind(
    paymentController_1.paymentController
  )
);
// Get all customers with Stripe IDs
router.get(
  '/customers',
  paymentController_1.paymentController.getCustomersWithStripeId.bind(
    paymentController_1.paymentController
  )
);
exports.default = router;
