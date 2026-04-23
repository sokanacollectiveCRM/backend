import 'dotenv/config';

import cors from 'cors';
import express, { Express, NextFunction, Request, Response } from 'express';
import helmet from 'helmet';

import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';

import {
  FEATURE_QUICKBOOKS,
  IS_PRODUCTION,
  getAllowedOrigins,
} from './config/env';
import { logger } from './common/utils/logger';
import emailRoutes from './routes/EmailRoutes';
import authRoutes from './routes/authRoutes';
import adminRoutes from './routes/adminRoutes';
import doulasRoutes from './routes/doulas';
import clientRoutes from './routes/clientRoutes';
import doulaRoutes from './routes/doulaRoutes';
import contractRoutes from './routes/contractRoutes';
import contractSigningRoutes from './routes/contractSigningRoutes';
import paymentRoutes from './routes/paymentRoutes';
import invoiceRoutes from './routes/invoiceRoutes';
import financialRoutes from './routes/financialRoutes';
import pdfContractRoutes from './routes/pdfContractRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import requestRouter from './routes/requestRoute';
import signNowRoutes from './routes/signNowRoutes';
import userRoutes from './routes/specificUserRoutes';
import { authController } from './index';

const app: Express = express();

app.disable('x-powered-by');
app.use(helmet());

// ---- Helper to normalize ESM/CJS route modules ----
const asMiddleware = (m: any) =>
  typeof m === 'function' ? m : (m?.default ?? m);

const allowedOriginsSet = new Set(getAllowedOrigins());
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin) return callback(null, true);
    if (allowedOriginsSet.has(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Token'],
  credentials: true, // Required for cookie (sb-access-token) and Bearer auth cross-origin
  maxAge: 86400,
};

app.use(cors(corsOptions));

if (!IS_PRODUCTION) {
  logger.info({ allowedOrigins: getAllowedOrigins(), credentials: corsOptions.credentials }, 'CORS configuration');
}

app.use(cookieParser());

app.use(express.json());

const httpLogger = pinoHttp({
  logger,
  redact: {
    paths: [
      'req.headers.cookie',
      'req.headers.authorization',
      'req.headers["x-session-token"]',
      'req.body.email',
      'req.body.password',
      'req.body.session_token',
      'req.body.token',
      'req.body.intuit_token',
      'req.body.cardToken',
      'req.body.card.number',
      'req.body.card.cvc',
      'req.body.card.expMonth',
      'req.body.card.expYear',
      'req.body.address',
      'req.body.ssn',
      'req.body.phone',
      'req.body.health_history',
      'req.body.dob',
      'req.body.*.email',
      'req.body.*.*.email',
      'res.body.session_token',
    ],
    censor: '[PHI_REDACTED]',
  },
  serializers: {
    req(req) {
      return {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: req.body,
      };
    },
    res(res) {
      return { statusCode: res.statusCode };
    },
  },
});
app.use(httpLogger);

// normalize duplicate slashes
app.use((req, _res, next) => {
  req.url = req.url.replace(/\/+/g, '/');
  next();
});

// ---- Mount other routes (wrapped for ESM/CJS compatibility) ----
// Alias so frontend can use POST /login or POST /auth/login
app.post('/login', (req, res) => authController.login(req, res));
app.use('/auth', asMiddleware(authRoutes));
app.use('/api', asMiddleware(doulasRoutes));
app.use('/api/admin', asMiddleware(adminRoutes));
app.use('/api/doulas', asMiddleware(doulaRoutes));
app.use('/email', asMiddleware(emailRoutes));
app.use('/requestService', asMiddleware(requestRouter));
app.use('/clients', asMiddleware(clientRoutes));
app.use('/client', asMiddleware(clientRoutes)); // alias
app.use('/api/clients', asMiddleware(clientRoutes)); // alias for frontend paths
app.use('/api/client', asMiddleware(clientRoutes)); // alias for frontend paths

if (FEATURE_QUICKBOOKS) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const quickbookRoutes = require('./routes/quickbooksRoutes').default;
  const customersRoutes = require('./routes/customersRoutes').default;
  const paymentMethodRoutes = require('./routes/paymentMethodRoutes').default;
  app.use('/quickbooks', asMiddleware(quickbookRoutes));
  app.use('/api/quickbooks', asMiddleware(quickbookRoutes));
  app.use('/quickbooks/customers', asMiddleware(customersRoutes));
  app.use('/api/payment-methods', asMiddleware(paymentMethodRoutes));
  app.use('/api/quickbooks/payment-methods', asMiddleware(paymentMethodRoutes));
  app.use('/quickbooks/payment-methods', asMiddleware(paymentMethodRoutes));
}

app.use('/users', asMiddleware(userRoutes));
app.use('/api/contract', asMiddleware(contractRoutes));
app.use('/api/contract-signing', asMiddleware(contractSigningRoutes));
app.use('/api/dashboard', asMiddleware(dashboardRoutes));
app.use('/api/pdf-contract', asMiddleware(pdfContractRoutes));
app.use('/api/payments', asMiddleware(paymentRoutes));
app.use('/api/invoices', asMiddleware(invoiceRoutes));
app.use('/api/financial', asMiddleware(financialRoutes));
app.use('/api/signnow', asMiddleware(signNowRoutes));

// DEV-only debug routes — NEVER in production (no token/cookie endpoints)
if (!IS_PRODUCTION && process.env.ENABLE_DEBUG_ENDPOINTS === 'true') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const debugRoutes = require('./routes/debugRoutes').default;
  app.use('/debug', asMiddleware(debugRoutes));
}

app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

// Health check: no external deps (Supabase/Stripe), always available
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'sokana-private-api',
    timestamp: new Date().toISOString(),
  });
});

interface AppError extends Error {
  status?: number;
}

// global error handler
// eslint-disable-next-line no-unused-vars
app.use((err: AppError, _req: Request, res: Response, _next: NextFunction) => {
  res.status(err.status || 500).json({
    error: IS_PRODUCTION ? 'Internal Server Error' : err.message,
  });
});

export default app;
