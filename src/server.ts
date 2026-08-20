import cors from 'cors';
import 'dotenv/config';
import express, { Express, NextFunction, Request, Response } from 'express';
import helmet from 'helmet';

import cookieParser from 'cookie-parser';

import { logger } from './common/utils/logger';
import {
  createSafeRequestLogger,
  installProductionConsoleGuard,
} from './common/utils/safeLogging';
import {
  FEATURE_QUICKBOOKS,
  IS_PRODUCTION,
  getAllowedOrigins,
} from './config/env';
import { authController } from './index';
import { validateBody } from './middleware/validateRequest';
import emailRoutes from './routes/EmailRoutes';
import adminRoutes from './routes/adminRoutes';
import authRoutes from './routes/authRoutes';
import billingRoutes from './routes/billingRoutes';
import clientRoutes from './routes/clientRoutes';
import contractRoutes from './routes/contractRoutes';
import contractSigningRoutes from './routes/contractSigningRoutes';
import contractTemplateRoutes from './routes/contractTemplateRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import doulaRoutes from './routes/doulaRoutes';
import doulasRoutes from './routes/doulas';
import financialRoutes from './routes/financialRoutes';
import invoiceRoutes from './routes/invoiceRoutes';
import paymentRoutes from './routes/paymentRoutes';
import pdfContractRoutes from './routes/pdfContractRoutes';
import requestRouter from './routes/requestRoute';
import signNowRoutes from './routes/signNowRoutes';
import userRoutes from './routes/specificUserRoutes';
import { ApiErrorCode } from './security/errorCodes';
import { loginBodySchema } from './security/requestSchemas';
import { deprecateAlias } from './security/routeDeprecationTelemetry';

const app: Express = express();

installProductionConsoleGuard();

app.disable('x-powered-by');
app.use(helmet());

// ---- Helper to normalize ESM/CJS route modules ----
const asMiddleware = (m: any) =>
  typeof m === 'function' ? m : (m?.default ?? m);

const allowedOriginsSet = new Set(getAllowedOrigins());
const corsOptions = {
  origin: (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void
  ) => {
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
  logger.info(
    {
      allowedOrigins: getAllowedOrigins(),
      credentials: corsOptions.credentials,
    },
    'CORS configuration'
  );
}

app.use(cookieParser());

// Capture raw body for provider webhook HMAC (SignNow / Intuit).
app.use(
  express.json({
    verify: (req, _res, buf, encoding) => {
      try {
        const rawReq = req as express.Request & { rawBody?: Buffer };
        rawReq.rawBody = Buffer.isBuffer(buf)
          ? Buffer.from(buf)
          : Buffer.from(buf || '', (encoding as BufferEncoding) || 'utf8');
      } catch {
        (req as express.Request & { rawBody?: Buffer }).rawBody =
          Buffer.alloc(0);
      }
    },
  })
);

app.use(createSafeRequestLogger(logger));

// normalize duplicate slashes
app.use((req, _res, next) => {
  req.url = req.url.replace(/\/+/g, '/');
  next();
});

// ---- Mount other routes (wrapped for ESM/CJS compatibility) ----
// Legacy alias POST /login → prefer /auth/login (PR 7 deprecation headers + telemetry).
app.post(
  '/login',
  deprecateAlias({ aliasKey: 'alias.login', successorPath: '/auth/login' }),
  validateBody(loginBodySchema),
  (req, res) => authController.login(req, res)
);
app.use('/auth', asMiddleware(authRoutes));
app.use('/api', asMiddleware(doulasRoutes));
app.use('/api/admin', asMiddleware(adminRoutes));
app.use('/api/doulas', asMiddleware(doulaRoutes));
app.use('/email', asMiddleware(emailRoutes));
app.use('/requestService', asMiddleware(requestRouter));
app.use('/clients', asMiddleware(clientRoutes));
// Deprecated singular / fewer-used aliases — keep mounted; measure usage (PR 7).
app.use(
  '/client',
  deprecateAlias({ aliasKey: 'alias.client', successorPath: '/clients' }),
  asMiddleware(clientRoutes)
);
app.use('/api/clients', asMiddleware(clientRoutes));
app.use(
  '/api/client',
  deprecateAlias({
    aliasKey: 'alias.api_client',
    successorPath: '/api/clients',
  }),
  asMiddleware(clientRoutes)
);

// eslint-disable-next-line @typescript-eslint/no-var-requires
const paymentMethodRoutes = require('./routes/paymentMethodRoutes').default;

if (FEATURE_QUICKBOOKS) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const quickbookRoutes = require('./routes/quickbooksRoutes').default;
  const customersRoutes = require('./routes/customersRoutes').default;
  app.use('/quickbooks', asMiddleware(quickbookRoutes));
  app.use('/api/quickbooks', asMiddleware(quickbookRoutes));
  app.use('/quickbooks/customers', asMiddleware(customersRoutes));
  // Aliases kept under the QB flag for historical FE paths.
  app.use('/api/quickbooks/payment-methods', asMiddleware(paymentMethodRoutes));
  app.use('/quickbooks/payment-methods', asMiddleware(paymentMethodRoutes));
}

// Card-on-file status is required by CRM Payment Schedule even when QB OAuth
// routes are disabled (production often runs FEATURE_QUICKBOOKS=false).
app.use('/api/payment-methods', asMiddleware(paymentMethodRoutes));

app.use('/users', asMiddleware(userRoutes));
app.use('/api/contract', asMiddleware(contractRoutes));
// Frontend Contracts page: GET/POST /contracts/templates (Supabase storage)
app.use('/contracts', asMiddleware(contractTemplateRoutes));
app.use('/api/contracts', asMiddleware(contractTemplateRoutes));
app.use('/api/contract-signing', asMiddleware(contractSigningRoutes));
app.use('/api/dashboard', asMiddleware(dashboardRoutes));
app.use('/api/pdf-contract', asMiddleware(pdfContractRoutes));
app.use('/api/payments', asMiddleware(paymentRoutes));
app.use('/api/invoices', asMiddleware(invoiceRoutes));
app.use('/api/financial', asMiddleware(financialRoutes));
app.use('/api/billing', asMiddleware(billingRoutes));
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
    code: ApiErrorCode.INTERNAL_ERROR,
  });
});

export default app;
