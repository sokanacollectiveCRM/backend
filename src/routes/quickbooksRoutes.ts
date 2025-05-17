// src/features/quickbooks/routes/quickbooksRoutes.ts
import { Router } from 'express'
import {
  connectQuickBooks,
  createInvoice,
  handleQuickBooksCallback,
  quickBooksAuthUrl,
  quickBooksDisconnect,
  quickBooksStatus
} from '../controllers/quickbooksController'
import authMiddleware from '../middleware/authMiddleware'
import authorizeRoles from '../middleware/authorizeRoles'

const router = Router()

// 1️⃣ Public OAuth endpoints (no auth required for redirect/callback)
router.get('/auth',     connectQuickBooks)
router.get('/callback', handleQuickBooksCallback)

// 2️⃣ Now apply auth + admin guard to the rest
router.use(authMiddleware)
router.use((req, res, next) => authorizeRoles(req, res, next, ['admin']))

// 3️⃣ Protected AJAX endpoints
router.get('/auth/url',  quickBooksAuthUrl)
router.get('/status',    quickBooksStatus)
router.post('/disconnect', quickBooksDisconnect)
router.post('/invoice',  createInvoice)

export default router
