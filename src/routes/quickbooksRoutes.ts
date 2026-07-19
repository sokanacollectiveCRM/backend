// src/features/quickbooks/routes/quickbooksRoutes.ts
import { Router } from 'express'
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
  refreshQuickBooksCustomerSyncStatus
} from '../controllers/quickbooksController'
import authMiddleware from '../middleware/authMiddleware'
import authorizeRoles from '../middleware/authorizeRoles'
import { quickBooksInvoicePaidWebhook } from '../controllers/quickbooksWebhookController'
import { simulatePaymentController } from '../services/payments/paymentsController'

const router = Router()

// 1️⃣ Public OAuth endpoints (no auth required for redirect/callback)
router.get('/auth', connectQuickBooks)
router.get('/callback', handleQuickBooksCallback)

// 2️⃣ Now apply auth + admin guard to the rest
router.use(authMiddleware)
router.use((req, res, next) => authorizeRoles(req, res, next, ['admin', 'billing']))

// 3️⃣ Protected AJAX endpoints
router.get('/auth/url', quickBooksAuthUrl)
router.get('/status', quickBooksStatus)
router.get('/invoices', getInvoices)
router.get('/customers', getQuickBooksCustomers)
router.get('/customers/invoiceable', getInvoiceableCustomersController)
router.post('/customers/:clientId/sync-status/refresh', refreshQuickBooksCustomerSyncStatus)
router.post('/customer', createCustomer)
router.post('/disconnect', quickBooksDisconnect)
router.post('/invoice', createInvoice)
router.post('/webhooks/invoice-paid', quickBooksInvoicePaidWebhook)

// Simulate payment endpoint
router.post('/simulate-payment', simulatePaymentController)

export default router
