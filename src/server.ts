import cors from 'cors';
import dotenv from 'dotenv';
import express, { Express, NextFunction, Request, Response } from 'express';

import cookieParser from 'cookie-parser';

import emailRoutes from './routes/EmailRoutes';
import authRoutes from './routes/authRoutes';
import adminRoutes from './routes/adminRoutes';
import clientRoutes from './routes/clientRoutes';
import doulaRoutes from './routes/doulaRoutes';
import contractPaymentRoutes from './routes/contractPaymentRoutes';
import contractRoutes from './routes/contractRoutes';
import contractSigningRoutes from './routes/contractSigningRoutes';
import customersRoutes from './routes/customersRoutes';
import paymentRoutes from './routes/paymentRoutes';
import pdfContractRoutes from './routes/pdfContractRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import quickbookRoutes from './routes/quickbooksRoutes';
import requestRouter from './routes/requestRoute';
import signNowRoutes from './routes/signNowRoutes';
import userRoutes from './routes/specificUserRoutes';
import stripePaymentRoutes from './routes/stripePaymentRoutes';

dotenv.config();

const app: Express = express();

// ---- Helper to normalize ESM/CJS route modules ----
const asMiddleware = (m: any) =>
  typeof m === 'function' ? m : (m?.default ?? m);

const allowedOrigins = new Set(
  [
    process.env.CORS_ORIGIN,
    process.env.FRONTEND_URL,
    process.env.FRONTEND_URL_DEV,
    'http://localhost:3001',
    'http://localhost:3000',
    'http://localhost:5050',
  ].filter(Boolean) as string[]
);

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400,
};

app.use(cors(corsOptions));

if (process.env.NODE_ENV !== 'production') {
  console.log('CORS Configuration:', {
    origin: process.env.FRONTEND_URL,
    credentials: true,
  });
}

app.use(cookieParser());

// ---- Mount webhook routes BEFORE JSON parsing ----
// Stripe webhook needs raw body data
app.use('/api/stripe', asMiddleware(stripePaymentRoutes));

app.use(express.json());

// normalize duplicate slashes
app.use((req, _res, next) => {
  req.url = req.url.replace(/\/+/g, '/');
  next();
});

// ---- Mount other routes (wrapped for ESM/CJS compatibility) ----
app.use('/auth', asMiddleware(authRoutes));
app.use('/api/admin', asMiddleware(adminRoutes));
app.use('/api/doulas', asMiddleware(doulaRoutes));
app.use('/email', asMiddleware(emailRoutes));
app.use('/requestService', asMiddleware(requestRouter));
app.use('/clients', asMiddleware(clientRoutes));
app.use('/client', asMiddleware(clientRoutes)); // alias
app.use('/quickbooks', asMiddleware(quickbookRoutes));
app.use('/api/quickbooks', asMiddleware(quickbookRoutes)); // Also mount at /api/quickbooks for callback compatibility
app.use('/quickbooks/customers', asMiddleware(customersRoutes));
app.use('/users', asMiddleware(userRoutes));
app.use('/api/contract', asMiddleware(contractRoutes));
app.use('/api/contract-signing', asMiddleware(contractSigningRoutes));
app.use('/api/dashboard', asMiddleware(dashboardRoutes));
app.use('/api/pdf-contract', asMiddleware(pdfContractRoutes));
app.use('/api/payments', asMiddleware(paymentRoutes));
app.use('/api/signnow', asMiddleware(signNowRoutes));
app.use('/api/contract-payment', asMiddleware(contractPaymentRoutes));

app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

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
    error:
      process.env.NODE_ENV === 'production'
        ? 'Internal Server Error'
        : err.message,
  });
});

export default app;
