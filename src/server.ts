import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import express, { Express, NextFunction, Request, Response } from 'express';

import authRoutes from './routes/authRoutes';
import clientRoutes from './routes/clientRoutes';
import contractPaymentRoutes from './routes/contractPaymentRoutes';
import contractRoutes from './routes/contractRoutes';
import customersRoutes from './routes/customersRoutes';
import docusignRoutes from './routes/docusignRoutes';
import emailRoutes from './routes/EmailRoutes';
import paymentRoutes from './routes/paymentRoutes';
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

interface CorsOptions {
  origin: (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void
  ) => void;
  methods: string[];
  allowedHeaders: string[];
  credentials: boolean;
  maxAge: number;
}

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:3001',
      process.env.FRONTEND_URL_DEV || 'http://localhost:3000',
      'http://localhost:5050',
      'http://localhost:3001',
      'http://localhost:3000'
    ];

    if (allowedOrigins.includes(origin || '') || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
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
app.use(express.json());

// normalize duplicate slashes
app.use((req, _res, next) => {
  req.url = req.url.replace(/\/+/g, '/');
  next();
});

// ---- Mount routes (wrapped for ESM/CJS compatibility) ----
app.use('/auth', asMiddleware(authRoutes));
app.use('/email', asMiddleware(emailRoutes));
app.use('/requestService', asMiddleware(requestRouter));
app.use('/clients', asMiddleware(clientRoutes));
app.use('/client', asMiddleware(clientRoutes)); // alias
app.use('/quickbooks', asMiddleware(quickbookRoutes));
app.use('/quickbooks/customers', asMiddleware(customersRoutes));
app.use('/users', asMiddleware(userRoutes));
app.use('/api/contract', asMiddleware(contractRoutes));
app.use('/api/payments', asMiddleware(paymentRoutes));
app.use('/api/signnow', asMiddleware(signNowRoutes));
app.use('/api/contract-payment', asMiddleware(contractPaymentRoutes));
app.use('/api/stripe', asMiddleware(stripePaymentRoutes));
app.use('/api/docusign', asMiddleware(docusignRoutes));

app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

interface AppError extends Error {
  status?: number;
}

// global error handler
// eslint-disable-next-line no-unused-vars
app.use((err: AppError, _req: Request, res: Response, _next: NextFunction) => {
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
  });
});

const PORT = process.env.PORT || 5050;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3001'}`);
});

export default app;
