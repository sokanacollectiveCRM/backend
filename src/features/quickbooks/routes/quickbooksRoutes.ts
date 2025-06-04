import { Router } from 'express';
import {
    connectQuickBooks,
    handleQuickBooksCallback,
    quickBooksAuthUrl,
    quickBooksDisconnect,
    quickBooksStatus
} from '../controllers/quickbooksController';

const router = Router();

// Public OAuth endpoints (no auth required)
router.get('/auth', connectQuickBooks);
router.get('/callback', handleQuickBooksCallback);
router.get('/auth-url', quickBooksAuthUrl);

// Status endpoints (no auth required - using global token)
router.get('/status', quickBooksStatus);
router.post('/disconnect', quickBooksDisconnect);

export default router; 