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

import express, { Request, Response } from 'express';
import { config } from 'dotenv';

// Load environment variables
config();

import { verifySignature, captureRawBody } from './auth/verifySignature';
import { getClientPhi } from './controllers/phiController';
import { testConnection, closePool } from './db/pool';
import { ResponseBuilder } from './utils/responseBuilder';

const app = express();
const PORT = parseInt(process.env.PORT || '8080', 10);

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

// PHI endpoints (require signature verification)
app.post('/v1/phi/client', verifySignature, getClientPhi);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json(ResponseBuilder.error('Not found', 'NOT_FOUND'));
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: express.NextFunction) => {
  console.error('[Server] Unhandled error');
  res.status(500).json(ResponseBuilder.error('Internal server error', 'INTERNAL_ERROR'));
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
