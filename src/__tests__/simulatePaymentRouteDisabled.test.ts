import express from 'express';
import fs from 'fs';
import path from 'path';
import request from 'supertest';

import quickbooksRoutes from '../routes/quickbooksRoutes';
import paymentMethodRoutes from '../routes/paymentMethodRoutes';

let currentUser: { id: string; role: string; email: string } | null = null;

jest.mock('../middleware/authMiddleware', () => ({
  __esModule: true,
  default: (req: any, res: any, next: any) => {
    if (!currentUser) {
      res.status(401).json({
        error: 'No session token provided',
        code: 'UNAUTHENTICATED',
      });
      return;
    }
    req.user = currentUser;
    next();
  },
}));

jest.mock('../controllers/quickbooksController', () => ({
  connectQuickBooks: (_req: any, res: any) => res.status(200).json({ ok: true }),
  handleQuickBooksCallback: (_req: any, res: any) =>
    res.status(200).json({ ok: true }),
  quickBooksAuthUrl: (_req: any, res: any) =>
    res.status(200).json({ url: 'https://example.test' }),
  quickBooksStatus: (_req: any, res: any) =>
    res.status(200).json({ connected: false }),
  getInvoices: (_req: any, res: any) => res.status(200).json([]),
  getQuickBooksCustomers: (_req: any, res: any) => res.status(200).json([]),
  getInvoiceableCustomersController: (_req: any, res: any) =>
    res.status(200).json([]),
  refreshQuickBooksCustomerSyncStatus: (_req: any, res: any) =>
    res.status(200).json({ ok: true }),
  createCustomer: (_req: any, res: any) => res.status(200).json({ ok: true }),
  quickBooksDisconnect: (_req: any, res: any) =>
    res.status(200).json({ ok: true }),
  createInvoice: (_req: any, res: any) => res.status(201).json({ ok: true }),
}));

jest.mock('../controllers/paymentMethodController', () => ({
  paymentMethodController: {
    savePaymentMethod: (_req: any, res: any) =>
      res.status(200).json({ success: true, data: { on_file: true } }),
    getPaymentMethod: (_req: any, res: any) =>
      res.status(200).json({ success: true, data: { on_file: false } }),
  },
}));

const REMOVED_PAN_CVC_FILES = [
  'src/services/payments/paymentsController.ts',
  'src/services/payments/createCharge.ts',
  'src/services/payments/buildChargePayload.ts',
  'src/api/simulate-payment.ts',
  'src/routes/quickbooksRoutes.js',
];

describe('INV-10 simulate-payment route disabled', () => {
  const app = express();
  app.use(express.json());
  app.use('/quickbooks', quickbooksRoutes);
  app.use('/api/quickbooks', quickbooksRoutes);
  app.use('/api/payment-methods', paymentMethodRoutes);

  beforeEach(() => {
    currentUser = null;
  });

  it('does not register simulate-payment in quickbooksRoutes source', () => {
    const routeSrc = fs.readFileSync(
      path.join(__dirname, '../routes/quickbooksRoutes.ts'),
      'utf8'
    );
    expect(routeSrc).not.toMatch(/simulate-payment/);
    expect(routeSrc).not.toMatch(/simulatePaymentController/);
  });

  it.each(REMOVED_PAN_CVC_FILES)('removed legacy PAN/CVC handler %s', (relPath) => {
    expect(fs.existsSync(path.join(process.cwd(), relPath))).toBe(false);
  });

  it('payment-methods route accepts tokenized payload schema only', () => {
    const routeSrc = fs.readFileSync(
      path.join(__dirname, '../routes/paymentMethodRoutes.ts'),
      'utf8'
    );
    expect(routeSrc).toContain('intuit_token');
    expect(routeSrc).not.toMatch(/card\.number/);
    expect(routeSrc).not.toMatch(/\bcvc\b/i);
  });

  it.each([
    ['/quickbooks/simulate-payment'],
    ['/api/quickbooks/simulate-payment'],
  ] as const)(
    'returns 404 for authenticated admin on removed %s',
    async (pathPrefix) => {
      currentUser = {
        id: 'admin-user',
        role: 'admin',
        email: 'admin@test.example',
      };
      const res = await request(app).post(pathPrefix).send({
        amount: '1.00',
        card: {
          number: '4111111111111111',
          expMonth: '12',
          expYear: '2099',
          cvc: '123',
        },
      });
      expect(res.status).toBe(404);
    }
  );

  it('does not expose simulate-payment on payment-methods mount', async () => {
    currentUser = {
      id: 'admin-user',
      role: 'admin',
      email: 'admin@test.example',
    };
    const res = await request(app)
      .post('/api/payment-methods/simulate-payment')
      .send({
        client_id: '123e4567-e89b-12d3-a456-426614174000',
        intuit_token: 'tok_safe',
        request_id: 'req_1',
      });
    expect(res.status).toBe(404);
  });

  it('keeps tokenized payment-methods save mounted', async () => {
    currentUser = {
      id: 'admin-user',
      role: 'admin',
      email: 'admin@test.example',
    };
    const res = await request(app).post('/api/payment-methods').send({
      client_id: '123e4567-e89b-12d3-a456-426614174000',
      intuit_token: 'tok_safe',
      request_id: 'req_1',
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
