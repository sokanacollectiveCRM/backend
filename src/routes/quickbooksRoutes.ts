// src/features/quickbooks/routes/quickbooksRoutes.ts
import { Router } from 'express'
import {
  connectQuickBooks,
  createInvoice,
  getInvoices,
  getQuickBooksCustomers,
  handleQuickBooksCallback,
  quickBooksAuthUrl,
  quickBooksDisconnect,
  quickBooksStatus
} from '../controllers/quickbooksController'
import authMiddleware from '../middleware/authMiddleware'
import { simulatePaymentController } from '../services/payments/paymentsController'

const router = Router()

// 1️⃣ Public OAuth endpoints (no auth required for redirect/callback)
router.get('/auth', connectQuickBooks)
router.get('/callback', handleQuickBooksCallback)

// 2️⃣ Now apply auth + admin guard to the rest
router.use(authMiddleware)

// 3️⃣ Protected AJAX endpoints
router.get('/auth/url', quickBooksAuthUrl)
router.get('/status', quickBooksStatus)
router.get('/invoices', getInvoices)
router.get('/customers', getQuickBooksCustomers)
router.post('/disconnect', quickBooksDisconnect)
router.post('/invoice', createInvoice)

// Simulate payment endpoint
router.post('/simulate-payment', simulatePaymentController)

export default router
