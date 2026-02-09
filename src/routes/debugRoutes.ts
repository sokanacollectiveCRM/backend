/**
 * DEV-only debug routes. Mounted only when ENABLE_DEBUG_ENDPOINTS=true and NODE_ENV !== 'production'.
 */

import express, { Router } from 'express';
import { postSessionToken, getWhoami } from '../controllers/debugController';
import authMiddleware from '../middleware/authMiddleware';

const debugRoutes: Router = express.Router();

// POST /debug/session-token — no auth; accepts { email, password }, returns session token (admin only)
debugRoutes.post('/session-token', postSessionToken);

// GET /debug/whoami — requires auth (cookie or X-Session-Token)
debugRoutes.get('/whoami', authMiddleware, getWhoami);

export default debugRoutes;
