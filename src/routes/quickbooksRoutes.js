'use strict';
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
// src/features/quickbooks/routes/quickbooksRoutes.ts
const express_1 = require('express');
const quickbooksController_1 = require('../controllers/quickbooksController');
const authMiddleware_1 = __importDefault(
  require('../middleware/authMiddleware')
);
const paymentsController_1 = require('../services/payments/paymentsController');
const router = (0, express_1.Router)();
// 1️⃣ Public OAuth endpoints (no auth required for redirect/callback)
router.get('/auth', quickbooksController_1.connectQuickBooks);
router.get('/callback', quickbooksController_1.handleQuickBooksCallback);
// 2️⃣ Now apply auth + admin guard to the rest
router.use(authMiddleware_1.default);
// 3️⃣ Protected AJAX endpoints
router.get('/auth/url', quickbooksController_1.quickBooksAuthUrl);
router.get('/status', quickbooksController_1.quickBooksStatus);
router.get('/invoices', quickbooksController_1.getInvoices);
router.post('/disconnect', quickbooksController_1.quickBooksDisconnect);
router.post('/invoice', quickbooksController_1.createInvoice);
// Simulate payment endpoint
router.post(
  '/simulate-payment',
  paymentsController_1.simulatePaymentController
);
exports.default = router;
