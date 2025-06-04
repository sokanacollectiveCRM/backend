// src/features/quickbooks/controller/quickbooksController.ts
import { NextFunction, Request, Response } from 'express';
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

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role?: string;
      };
    }
  }
}

/**
 * Middleware to ensure only admin users can access QuickBooks functionality
 */
const ensureAdmin = (req: Request, res: Response, next: NextFunction) => {
  const user = req.user;
  if (!user?.role || user.role !== 'admin') {
    return res.status(403).json({ 
      error: 'Only administrators can access QuickBooks functionality' 
    });
  }
  next();
};

/**
 * JSON endpoint: return the Intuit consent URL for AJAX calls.
 * Admin only
 */
export const quickBooksAuthUrl = [
  ensureAdmin,
  (_req: Request, res: Response, next: NextFunction) => {
    try {
      const state = Math.random().toString(36).substring(2)
      const url   = generateConsentUrl(state)
      res.json({ url })
    } catch (err) {
      next(err)
    }
  }
]

/**
 * Redirect endpoint: used by window.open to start OAuth directly.
 * Admin only
 */
export const connectQuickBooks = [
  ensureAdmin,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const state = Math.random().toString(36).substring(2)
      const url   = generateConsentUrl(state)
      res.redirect(url)
    } catch (err) {
      next(err)
    }
  }
]

/**
 * OAuth callback: exchange code for tokens, persist them, then notify the opener.
 * Admin only
 */
export const handleQuickBooksCallback = [
  ensureAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
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
]

/**
 * Create an invoice - Admin only
 */
export const createInvoice = [
  ensureAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const invoice = await createInvoiceService(req.body);
      res.status(201).json(invoice);
    } catch (err) {
      next(err);
    }
  }
]

/**
 * Get invoiceable customers - Admin only
 */
export const getInvoiceableCustomersController = [
  ensureAdmin,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const customers = await getInvoiceableCustomers(supabase);
      res.json(customers);
    } catch (err: any) {
      next(err);
    }
  }
]

/**
 * Create a customer - Admin only
 */
export const createCustomer = [
  ensureAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = req.body as CreateCustomerParams
      const result = await createCustomerService(params)
      res.status(201).json(result)
    } catch (err) {
      next(err)
    }
  }
]

/**
 * Get QuickBooks connection status - available to any authenticated user
 */
export const quickBooksStatus = [
  ensureAdmin,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const connected = await isConnected()        // ← calls service, not getTokens
      res.json({ connected })
    } catch (err) {
      next(err)
    }
  }
]

/**
 * Disconnect QuickBooks - admin only
 */
export const quickBooksDisconnect = [
  ensureAdmin,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      await disconnectQuickBooks()                // ← calls service, not deleteTokens
      res.json({ disconnected: true })
    } catch (err) {
      next(err)
    }
  }
]

/**
 * GET /quickbooks/invoices
 *  Returns all invoices you've saved in Supabase
 */
export const getInvoices = async (_req: Request, res: Response, next: NextFunction) => {
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