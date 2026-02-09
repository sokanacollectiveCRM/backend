/**
 * PHI Broker Service - Cloud Run Entry Point
 * 
 * This service provides secure access to PHI data stored in Cloud SQL.
 * It is the ONLY component allowed to access the sensitive database.
 * 
 * HIPAA COMPLIANCE:
 * - All requests require HMAC signature verification
 * - PHI values are NEVER logged
 * - Only metadata is logged for audit purposes
 */

import crypto from 'crypto';
import express, { Request, Response, NextFunction } from 'express';
import { config } from 'dotenv';

// Load environment variables
config();

import { verifySignature, captureRawBody } from './auth/verifySignature';
import { getClientPhi, updateClientPhi } from './controllers/phiController';
import { testConnection, closePool } from './db/pool';
import { ResponseBuilder } from './utils/responseBuilder';

const app = express();
const PORT = parseInt(process.env.PORT || '8080', 10);

// Request-scoped ID for correlation (no PHI)
app.use((req: Request, _res: Response, next: NextFunction) => {
  (req as Request & { requestId?: string }).requestId = crypto.randomUUID();
  next();
});

// Parse JSON body and capture raw body for signature verification
app.use(express.json({ verify: captureRawBody }));

// Health check endpoint (no auth required)
app.get('/health', async (_req: Request, res: Response) => {
  try {
    const dbConnected = await testConnection();
    if (dbConnected) {
      res.json({ status: 'healthy', db: 'connected' });
    } else {
      res.status(503).json({ status: 'unhealthy', db: 'disconnected' });
    }
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', db: 'error' });
  }
});

// PHI endpoints (require signature verification) — async errors passed to error handler
function phiClientHandler(req: Request, res: Response, next: NextFunction): void {
  Promise.resolve(getClientPhi(req, res)).catch((err: unknown) => {
    const reqWithId = req as Request & { requestId?: string };
    const requestId = reqWithId.requestId;
    // HIPAA-safe: no PHI, no request body
    console.error('[Server] Unhandled error in PHI handler', {
      request_id: requestId,
      error_name: err instanceof Error ? err.name : 'Unknown',
      error_message: err instanceof Error ? err.message : String(err),
    });
    if (!res.headersSent) {
      res.status(500).json(ResponseBuilder.error('Internal server error', 'INTERNAL_ERROR', requestId));
    }
    next();
  });
}
app.post('/v1/phi/client', verifySignature, phiClientHandler);

// PHI update endpoint — same HMAC verification, admin-only authorization
function phiUpdateHandler(req: Request, res: Response, next: NextFunction): void {
  Promise.resolve(updateClientPhi(req, res)).catch((err: unknown) => {
    const reqWithId = req as Request & { requestId?: string };
    const requestId = reqWithId.requestId;
    console.error('[Server] Unhandled error in PHI update handler', {
      request_id: requestId,
      error_name: err instanceof Error ? err.name : 'Unknown',
      error_message: err instanceof Error ? err.message : String(err),
    });
    if (!res.headersSent) {
      res.status(500).json(ResponseBuilder.error('Internal server error', 'INTERNAL_ERROR', requestId));
    }
    next();
  });
}
app.post('/v1/phi/client/update', verifySignature, phiUpdateHandler);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json(ResponseBuilder.error('Not found', 'NOT_FOUND'));
});

// Error handler (receives errors passed via next(err))
app.use((err: Error, req: Request, res: Response, _next: express.NextFunction) => {
  const reqWithId = req as Request & { requestId?: string };
  const requestId = reqWithId.requestId;
  console.error('[Server] Unhandled error', {
    request_id: requestId,
    error_name: err.name,
    error_message: err.message,
  });
  if (!res.headersSent) {
    res.status(500).json(ResponseBuilder.error('Internal server error', 'INTERNAL_ERROR', requestId));
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Server] SIGTERM received, shutting down...');
  await closePool();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Server] SIGINT received, shutting down...');
  await closePool();
  process.exit(0);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] PHI Broker listening on port ${PORT}`);
  console.log('[Server] Environment:', {
    nodeEnv: process.env.NODE_ENV || 'development',
    hasSecret: !!process.env.PHI_BROKER_SHARED_SECRET,
    hasDbConfig: !!process.env.SENSITIVE_DATABASE_HOST,
  });
});
