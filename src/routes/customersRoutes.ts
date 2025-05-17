// src/features/quickbooks/routes/customersRoutes.js
import { Router } from 'express';

import { createCustomer } from '../controllers/quickbooksController';
const router = Router();

// POST /quickbooks/customers
router.post('/', createCustomer);

module.exports = router;
