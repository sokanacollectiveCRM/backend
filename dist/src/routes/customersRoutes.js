"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/features/quickbooks/routes/customersRoutes.js
const express_1 = require("express");
const quickbooksController_1 = require("../controllers/quickbooksController");
const router = (0, express_1.Router)();
// POST /quickbooks/customers
router.post('/', quickbooksController_1.createCustomer);
// GET /quickbooks/customers/invoiceable
router.get('/invoiceable', quickbooksController_1.getInvoiceableCustomersController);
exports.default = router;
