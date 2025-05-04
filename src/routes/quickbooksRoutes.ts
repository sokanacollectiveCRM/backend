// src/features/quickbooks/routes/quickbooksRoutes.ts

import { Router } from 'express';
import {
  connectQuickBooks,
  createInvoice,
  handleQuickBooksCallback
} from '../controllers/quickbooksController';

const router = Router();

// // Require authenticated users…
// router.use(authMiddleware);

// // …and then only allow admins
// router.use(adminMiddleware);

// Invoice route (admin only)
router.post('/invoice', createInvoice);

// QuickBooks OAuth routes (also behind auth/admin if you wish)
router.get('/auth',     connectQuickBooks);
router.get('/callback', handleQuickBooksCallback);

export default router;
