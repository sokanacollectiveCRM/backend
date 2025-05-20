// src/features/quickbooks/routes/customersRoutes.js
import { Router } from 'express';

import { createCustomer, getInvoiceableCustomersController } from '../controllers/quickbooksController';
const router = Router();

// POST /quickbooks/customers
router.post('/', createCustomer);


// GET /quickbooks/customers/invoiceable
router.get('/invoiceable', getInvoiceableCustomersController);

export default router;
