// src/routes/quickbooksRoutes.ts
import { Router } from 'express';

import {
  connectQuickBooks,
  createCustomer,
  createInvoice,
  getInvoiceableCustomersController,
  getInvoices,
  getQuickBooksCustomers,
  handleQuickBooksCallback,
  quickBooksAuthUrl,
  quickBooksDisconnect,
  quickBooksStatus,
  refreshQuickBooksCustomerSyncStatus,
} from '../controllers/quickbooksController';
import { quickBooksInvoicePaidWebhook } from '../controllers/quickbooksWebhookController';
import authMiddleware from '../middleware/authMiddleware';
import authorizeRoles from '../middleware/authorizeRoles';
import { requireQuickBooksWebhookAuth } from '../security/webhookAuth';
import { simulatePaymentController } from '../services/payments/paymentsController';

const router = Router();

const requireBillingStaff = (req: any, res: any, next: any) =>
  authorizeRoles(req, res, next, ['admin', 'billing']);

const requireAdmin = (req: any, res: any, next: any) =>
  authorizeRoles(req, res, next, ['admin']);

// 1️⃣ Public OAuth endpoints (no user-session auth)
router.get('/auth', connectQuickBooks);
router.get('/callback', handleQuickBooksCallback);

// Provider webhook — no CRM session; Intuit HMAC via QB_WEBHOOK_VERIFIER_TOKEN (PR 5).
// Security bug fix (PR 4): was registered after authMiddleware and required user cookies.
router.post(
  '/webhooks/invoice-paid',
  requireQuickBooksWebhookAuth,
  quickBooksInvoicePaidWebhook
);

// 2️⃣ Session auth + staff roles for CRM QuickBooks operations
router.use(authMiddleware);
router.use(requireBillingStaff);

// 3️⃣ Protected AJAX endpoints
router.get('/auth/url', quickBooksAuthUrl);
router.get('/status', quickBooksStatus);
router.get('/invoices', getInvoices);
router.get('/customers', getQuickBooksCustomers);
router.get('/customers/invoiceable', getInvoiceableCustomersController);
router.post(
  '/customers/:clientId/sync-status/refresh',
  refreshQuickBooksCustomerSyncStatus
);
router.post('/customer', createCustomer);
router.post('/disconnect', quickBooksDisconnect);
router.post('/invoice', createInvoice);

// Simulate payment — admin only
router.post('/simulate-payment', requireAdmin, simulatePaymentController);

export default router;
