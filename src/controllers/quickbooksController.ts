// src/features/quickbooks/controller/quickbooksController.ts

import { RequestHandler } from 'express';
import {
  generateConsentUrl,
  handleAuthCallback
} from '../services/auth/quickbooksAuthService';
import createCustomerService, {
  CreateCustomerParams
} from '../services/customer/createCustomer';
import createInvoiceService from '../services/invoice/createInvoice';

/**
 * Redirect merchant to Intuit’s consent screen
 */
export const connectQuickBooks: RequestHandler = async (req, res, next) => {
  try {
    const state = Math.random().toString(36).substring(2);
    const url   = generateConsentUrl(state);
    console.log('→ redirecting to Intuit:', url);
    res.redirect(url);
  } catch (err) {
    console.error('connectQuickBooks ERROR:', err);
    next(err);
  }
};

/**
 * Handle Intuit’s redirect back to your app:
 * exchange code for tokens, persist them, then respond
 */
export const handleQuickBooksCallback: RequestHandler = async (req, res, next) => {
  try {
    const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    console.log('→ full callback URL:', fullUrl);

    await handleAuthCallback(fullUrl);

    console.log('✅ tokens saved');
    res.send('QuickBooks connected successfully!');
  } catch (err) {
    console.error('handleQuickBooksCallback RAW error:', err);
    next(err);
  }
};

/**
 * Create an invoice
 */
export const createInvoice: RequestHandler = async (req, res, next) => {
  try {
    const invoice = await createInvoiceService(req.body);
    res.status(201).json(invoice);
  } catch (err) {
    next(err);
  }
};

/**
 * Create a customer
 * POST /api/customers
 * body: { internalCustomerId, firstName, lastName, email }
 */
export const createCustomer: RequestHandler = async (req, res, next) => {
  try {
    // delegate to service (which validates required fields)
    const params = req.body as CreateCustomerParams;
    const result = await createCustomerService(params);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};
