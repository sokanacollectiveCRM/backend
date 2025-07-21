"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInvoices = exports.quickBooksDisconnect = exports.quickBooksStatus = exports.createCustomer = exports.getInvoiceableCustomersController = exports.createInvoice = exports.handleQuickBooksCallback = exports.connectQuickBooks = exports.quickBooksAuthUrl = void 0;
const quickbooksAuthService_1 = require("../services/auth/quickbooksAuthService");
const createCustomer_1 = __importDefault(require("../services/customer/createCustomer"));
const createInvoice_1 = __importDefault(require("../services/invoice/createInvoice"));
const supabase_1 = __importDefault(require("../supabase"));
// ← 1) Import your invoiceable-customers logic
const getInvoiceableCustomers_1 = __importDefault(require("../services/customer/getInvoiceableCustomers"));
// Ensure you have SUPABASE_JWT_SECRET in your env
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET;
/**
 * JSON endpoint: return the Intuit consent URL for AJAX calls.
 */
const quickBooksAuthUrl = (_req, res, next) => {
    try {
        const state = Math.random().toString(36).substring(2);
        const url = (0, quickbooksAuthService_1.generateConsentUrl)(state);
        res.json({ url });
    }
    catch (err) {
        next(err);
    }
};
exports.quickBooksAuthUrl = quickBooksAuthUrl;
/**
 * Redirect endpoint: used by window.open to start OAuth directly.
 */
const connectQuickBooks = (req, res, next) => {
    try {
        const state = Math.random().toString(36).substring(2);
        const url = (0, quickbooksAuthService_1.generateConsentUrl)(state);
        res.redirect(url);
    }
    catch (err) {
        next(err);
    }
};
exports.connectQuickBooks = connectQuickBooks;
/**
 * OAuth callback: exchange code for tokens, persist them, then notify the opener.
 */
const handleQuickBooksCallback = async (req, res, next) => {
    try {
        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        await (0, quickbooksAuthService_1.handleAuthCallback)(fullUrl);
        res.send(`
      <html><body>
        <script>
           window.opener.postMessage({ success: true }, 'http://localhost:3001')
          window.close()
        </script>
      </body></html>
    `);
    }
    catch (err) {
        next(err);
    }
};
exports.handleQuickBooksCallback = handleQuickBooksCallback;
/**
 * Create an invoice
 */
const createInvoice = async (req, res, next) => {
    try {
        const invoice = await (0, createInvoice_1.default)(req.body);
        res.status(201).json(invoice);
    }
    catch (err) {
        next(err);
    }
};
exports.createInvoice = createInvoice;
/**
 * Get invoiceable customers
 */
const getInvoiceableCustomersController = async (_req, res, next) => {
    try {
        const customers = await (0, getInvoiceableCustomers_1.default)(supabase_1.default);
        res.json(customers);
    }
    catch (err) {
        next(err);
    }
};
exports.getInvoiceableCustomersController = getInvoiceableCustomersController;
/**
 * Create a customer
 */
const createCustomer = async (req, res, next) => {
    try {
        const params = req.body;
        const result = await (0, createCustomer_1.default)(params);
        res.status(201).json(result);
    }
    catch (err) {
        next(err);
    }
};
exports.createCustomer = createCustomer;
/**
 * Get QuickBooks connection status
 */
const quickBooksStatus = async (req, res, next) => {
    try {
        console.log('🔍 [QB Status] Checking connection status...');
        const connected = await (0, quickbooksAuthService_1.isConnected)();
        console.log('📊 [QB Status] Connection result:', connected);
        res.json({ connected });
    }
    catch (err) {
        console.error('❌ [QB Status] Error checking status:', err);
        next(err);
    }
};
exports.quickBooksStatus = quickBooksStatus;
/**
 * Disconnect QuickBooks
 */
const quickBooksDisconnect = async (req, res, next) => {
    try {
        await (0, quickbooksAuthService_1.disconnectQuickBooks)();
        res.json({ disconnected: true });
    }
    catch (err) {
        next(err);
    }
};
exports.quickBooksDisconnect = quickBooksDisconnect;
/**
 * GET /quickbooks/invoices
 * Returns all invoices you've saved in Supabase
 */
const getInvoices = async (_req, res, next) => {
    try {
        const { data, error } = await supabase_1.default
            .from('invoices')
            .select('*')
            .order('created_at', { ascending: false });
        if (error)
            throw error;
        res.json(data);
    }
    catch (err) {
        next(err);
    }
};
exports.getInvoices = getInvoices;
