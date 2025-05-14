// src/features/quickbooks/routes/quickbooksRoutes.ts

import { Router } from 'express';
import {
  connectQuickBooks,
  createInvoice,
  handleQuickBooksCallback,
  quickBooksAuthUrl,
  quickBooksDisconnect,
  quickBooksStatus,
} from '../controllers/quickbooksController';

const router = Router();

// // Require authenticated users…
// router.use(authMiddleware);

// // …and then only allow admins
// router.use(adminMiddleware);
// OAuth status & disconnect routes
router.get('/status', quickBooksStatus);
router.post('/disconnect', quickBooksDisconnect);
// Invoice route (admin only)
router.post('/invoice', createInvoice);

// QuickBooks OAuth routes (also behind auth/admin if you wish)
router.get('/auth/url', quickBooksAuthUrl)  // ← JSON URL for AJAX
router.get('/auth',     connectQuickBooks);
router.get('/callback', handleQuickBooksCallback);
// **QuickBooks OAuth routes**:


export default router;
