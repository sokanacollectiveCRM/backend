import { RequestHandler } from 'express';
import {
    disconnectQuickBooks,
    generateConsentUrl,
    handleAuthCallback,
    isConnected
} from '../services/auth/quickbooksAuthService';

/**
 * JSON endpoint: return the Intuit consent URL for AJAX calls.
 */
export const quickBooksAuthUrl: RequestHandler = (_req, res, next) => {
  try {
    const state = Math.random().toString(36).substring(2);
    const url = generateConsentUrl(state);
    res.json({ url });
  } catch (err) {
    next(err);
  }
};

/**
 * Redirect endpoint: used by window.open to start OAuth directly.
 */
export const connectQuickBooks: RequestHandler = (_req, res, next) => {
  try {
    const state = Math.random().toString(36).substring(2);
    const url = generateConsentUrl(state);
    res.redirect(url);
  } catch (err) {
    next(err);
  }
};

/**
 * OAuth callback: exchange code for tokens, persist them, then notify the opener.
 */
export const handleQuickBooksCallback: RequestHandler = async (req, res, next) => {
  try {
    const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    await handleAuthCallback(fullUrl);
    res.send(`
      <html><body>
        <script>
          window.opener.postMessage({ success: true }, '${process.env.FRONTEND_URL || 'http://localhost:3001'}');
          window.close();
        </script>
      </body></html>
    `);
  } catch (err) {
    next(err);
  }
};

/**
 * Get QuickBooks connection status
 */
export const quickBooksStatus: RequestHandler = async (_req, res, next) => {
  try {
    const connected = await isConnected();
    res.json({ connected });
  } catch (err) {
    next(err);
  }
};

/**
 * Disconnect QuickBooks
 */
export const quickBooksDisconnect: RequestHandler = async (_req, res, next) => {
  try {
    await disconnectQuickBooks();
    res.json({ disconnected: true });
  } catch (err) {
    next(err);
  }
}; 