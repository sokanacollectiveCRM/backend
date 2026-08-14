// src/features/quickbooks/routes/customersRoutes.js
import { Router } from 'express';
import authMiddleware from '../middleware/authMiddleware';
import authorizeRoles from '../middleware/authorizeRoles';

import { createCustomer, getInvoiceableCustomersController } from '../controllers/quickbooksController';
const router = Router();

const requireStaff = (req: any, res: any, next: any) => authorizeRoles(req, res, next, ['admin', 'billing']);
router.use(authMiddleware);
router.use(requireStaff);

// POST /quickbooks/customers — security bug fix (PR 4): was anonymous
router.post('/', createCustomer);

// GET /quickbooks/customers/invoiceable — security bug fix (PR 4): was anonymous
router.get('/invoiceable', getInvoiceableCustomersController);

export default router;
