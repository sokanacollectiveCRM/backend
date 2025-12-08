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
import getCustomersFromQuickBooks from '../services/customer/getCustomersFromQuickBooks';
// Ensure you have SUPABASE_JWT_SECRET in your env
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET!

/**
 * JSON endpoint: return the Intuit consent URL for AJAX calls.
 */
export const quickBooksAuthUrl: RequestHandler = (_req, res, next) => {
  try {
    // Validate required environment variables
    const { QB_CLIENT_ID, QB_CLIENT_SECRET, QB_REDIRECT_URI } = process.env;

    if (!QB_CLIENT_ID || !QB_CLIENT_SECRET || !QB_REDIRECT_URI) {
      console.error('❌ [QB Auth] Missing required environment variables:', {
        hasClientId: !!QB_CLIENT_ID,
        hasClientSecret: !!QB_CLIENT_SECRET,
        hasRedirectUri: !!QB_REDIRECT_URI
      });
      return res.status(500).json({
        error: 'QuickBooks configuration is incomplete. Please check server environment variables.',
        details: 'Missing QB_CLIENT_ID, QB_CLIENT_SECRET, or QB_REDIRECT_URI'
      });
    }

    const state = Math.random().toString(36).substring(2)
    const url = generateConsentUrl(state)

    if (!url) {
      console.error('❌ [QB Auth] Failed to generate consent URL');
      return res.status(500).json({
        error: 'Could not generate QuickBooks authorization URL'
      });
    }

    console.log('✅ [QB Auth] Generated auth URL successfully');
    res.json({ url })
  } catch (err: any) {
    console.error('❌ [QB Auth] Error generating auth URL:', err);
    res.status(500).json({
      error: 'Could not fetch QuickBooks auth URL',
      details: err?.message || 'Unknown error occurred'
    });
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
 * OAuth callback: exchange code for tokens, persist them, then redirect to dashboard.
 */
export const handleQuickBooksCallback: RequestHandler = async (req, res, next) => {
  try {
    const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`
    console.log('🔄 [QB Callback] Processing OAuth callback:', fullUrl);

    await handleAuthCallback(fullUrl)
    console.log('✅ [QB Callback] QuickBooks connected successfully');

    // Get frontend URL from environment or default
    const frontendUrl = process.env.FRONTEND_URL || process.env.FRONTEND_URL_DEV || 'http://localhost:3001';

    // Redirect to dashboard with success message
    const redirectUrl = `${frontendUrl}/dashboard?quickbooks=connected`;
    console.log('🔀 [QB Callback] Redirecting to:', redirectUrl);

    res.send(`
      <html><body>
        <script>
          // Try to notify opener if this was opened in a popup
          if (window.opener) {
            try {
              window.opener.postMessage({
                success: true,
                source: 'quickbooks-oauth',
                message: 'QuickBooks connected successfully'
              }, '${frontendUrl}');
              window.close();
            } catch (e) {
              console.error('Failed to notify opener:', e);
              window.location.href = '${redirectUrl}';
            }
          } else {
            // If no opener, redirect directly
            window.location.href = '${redirectUrl}';
          }
        </script>
        <p>QuickBooks connected successfully! Redirecting...</p>
        <p>If you are not redirected, <a href="${redirectUrl}">click here</a>.</p>
      </body></html>
    `)
  } catch (err) {
    console.error('❌ [QB Callback] Error processing callback:', err);
    const frontendUrl = process.env.FRONTEND_URL || process.env.FRONTEND_URL_DEV || 'http://localhost:3001';
    const errorRedirectUrl = `${frontendUrl}/dashboard?quickbooks=error&message=${encodeURIComponent(err instanceof Error ? err.message : 'Connection failed')}`;

    res.send(`
      <html><body>
        <script>
          window.location.href = '${errorRedirectUrl}';
        </script>
        <p>Error connecting QuickBooks. Redirecting...</p>
        <p>If you are not redirected, <a href="${errorRedirectUrl}">click here</a>.</p>
      </body></html>
    `)
  }
}

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
}

/**
 * Get invoiceable customers
 */
export const getInvoiceableCustomersController: RequestHandler = async (_req, res, next) => {
  try {
    const customers = await getInvoiceableCustomers(supabase);
    res.json(customers);
  } catch (err: any) {
    next(err);
  }
}

/**
 * Create a customer
 */
export const createCustomer: RequestHandler = async (req, res, next) => {
  try {
    const params: CreateCustomerParams = req.body;
    const result = await createCustomerService(params)
    res.status(201).json(result)
  } catch (err) {
    next(err)
  }
}

/**
 * Get QuickBooks connection status
 */
export const quickBooksStatus: RequestHandler = async (req, res, next) => {
  try {
    console.log('🔍 [QB Status] Checking connection status...');
    const connected = await isConnected();
    console.log('📊 [QB Status] Connection result:', connected);
    res.json({ connected });
  } catch (err) {
    console.error('❌ [QB Status] Error checking status:', err);
    next(err);
  }
}

/**
 * Disconnect QuickBooks
 */
export const quickBooksDisconnect: RequestHandler = async (req, res, next) => {
  try {
    await disconnectQuickBooks()
    res.json({ disconnected: true })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /quickbooks/invoices
 * Returns all invoices you've saved in Supabase
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

/**
 * GET /quickbooks/customers
 * Returns all customers from QuickBooks Online
 */
export const getQuickBooksCustomers: RequestHandler = async (req, res, next) => {
  try {
    console.log('📋 [QB Customers] Fetching customers from QuickBooks...');

    // Optional query parameter for max results
    const maxResults = req.query.maxResults
      ? parseInt(req.query.maxResults as string, 10)
      : 100;

    const customers = await getCustomersFromQuickBooks(maxResults);

    console.log(`✅ [QB Customers] Returning ${customers.length} customers`);
    res.json(customers);
  } catch (err: any) {
    console.error('❌ [QB Customers] Error fetching customers:', err);
    res.status(500).json({
      error: 'Failed to fetch customers from QuickBooks',
      message: err.message || 'Unknown error'
    });
  }
}
