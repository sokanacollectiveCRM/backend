// src/features/quickbooks/routes/customersRoutes.js
import { Router } from 'express';
import authMiddleware from '../middleware/authMiddleware';
import authorizeRoles from '../middleware/authorizeRoles';

import { createCustomer, getInvoiceableCustomersController } from '../controllers/quickbooksController';
const router = Router();

router.use(
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin', 'billing'])
);

// POST /quickbooks/customers
router.post('/', createCustomer);


// GET /quickbooks/customers/invoiceable
router.get('/invoiceable', getInvoiceableCustomersController);

export default router;
