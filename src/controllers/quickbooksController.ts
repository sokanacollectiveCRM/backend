// src/features/quickbooks/controller/quickbooksController.ts
import { RequestHandler } from 'express';
import {
  disconnectQuickBooks,
  generateConsentUrl,
  handleAuthCallback,
  isConnected
} from '../services/auth/quickbooksAuthService';
import createCustomerService, { CreateCustomerParams } from '../services/customer/createCustomer';
import createInvoiceService from '../services/invoice/createInvoice';
import supabase from '../supabase';
// ← 1) Import your invoiceable-customers logic
import getInvoiceableCustomers from '../services/customer/getInvoiceableCustomers';
// Ensure you have SUPABASE_JWT_SECRET in your env
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET!



/**
 * JSON endpoint: return the Intuit consent URL for AJAX calls.
 */
/**
 * JSON endpoint: return the Intuit consent URL for AJAX calls.
 */
export const quickBooksAuthUrl: RequestHandler = (_req, res, next) => {
  try {
    const state = Math.random().toString(36).substring(2)
    const url   = generateConsentUrl(state)
    res.json({ url })
  } catch (err) {
    next(err)
  }
}

/**
 * Redirect endpoint: used by window.open to start OAuth directly.
 */
export const connectQuickBooks: RequestHandler = (req, res, next) => {
  try {
    const state = Math.random().toString(36).substring(2)
    const url   = generateConsentUrl(state)
    res.redirect(url)
  } catch (err) {
    next(err)
  }
}

/**
 * OAuth callback: exchange code for tokens, persist them, then notify the opener.
 */
export const handleQuickBooksCallback: RequestHandler = async (req, res, next) => {
  try {
    const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`
    await handleAuthCallback(fullUrl)
    res.send(`
      <html><body>
        <script>
           window.opener.postMessage({ success: true }, 'http://localhost:3001')
          window.close()
        </script>
      </body></html>
    `)
  } catch (err) {
    next(err)
  }
}

/**
 * Create an invoice
 */
export const createInvoice: RequestHandler = async (req, res, next) => {
  try {
    const invoice = await createInvoiceService(req.body)
    res.status(201).json(invoice)
  } catch (err) {
    next(err)
  }
}



/**
 * GET /quickbooks/customers/invoiceable
 * Returns all internal customers with role = 'customer'
 */

export const getInvoiceableCustomersController: RequestHandler = async (_req, res, next) => {
  try {
    const customers = await getInvoiceableCustomers(supabase);
    res.json(customers);
  } catch (err: any) {
    next(err);
  }
};


/**
 * Create a customer
 */
export const createCustomer: RequestHandler = async (req, res, next) => {
  try {
    const params = req.body as CreateCustomerParams
    const result = await createCustomerService(params)
    res.status(201).json(result)
  } catch (err) {
    next(err)
  }
}

export const quickBooksStatus: RequestHandler = async (_req, res, next) => {
  try {
    const connected = await isConnected()        // ← calls service, not getTokens
    res.json({ connected })
  } catch (err) {
    next(err)
  }
}

export const quickBooksDisconnect: RequestHandler = async (_req, res, next) => {
  try {
    await disconnectQuickBooks()                // ← calls service, not deleteTokens
    res.json({ disconnected: true })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /quickbooks/invoices
 *  Returns all invoices you’ve saved in Supabase
 */
export const getInvoices: RequestHandler = async (_req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    res.json(data)
  } catch (err) {
    next(err)
  }
}