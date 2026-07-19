import express from 'express';
import request from 'supertest';

jest.mock('../middleware/authMiddleware', () => ({
  __esModule: true,
  default: (req: any, res: any, next: any) => {
    const role = req.get('x-test-role');
    if (!role) {
      res.status(401).json({ error: 'No session token provided' });
      return;
    }
    req.user = { id: 'synthetic-user', email: 'synthetic@example.test', role };
    next();
  },
}));

jest.mock('../services/signNowService', () => ({
  SignNowService: jest.fn().mockImplementation(() => ({ testAuthentication: jest.fn() })),
  signNowService: { testAuthentication: jest.fn() },
}));
jest.mock('../utils/signNowContractProcessor', () => ({
  checkSignNowDocumentStatus: jest.fn(),
  processContractWithSignNow: jest.fn(),
}));
jest.mock('../controllers/signNowWebhookController', () => ({
  signNowCallback: (_req: any, res: any) => res.sendStatus(204),
}));
jest.mock('../controllers/quickbooksController', () => ({
  connectQuickBooks: jest.fn(),
  createCustomer: jest.fn(),
  createInvoice: jest.fn(),
  getInvoiceableCustomersController: jest.fn(),
  getInvoices: jest.fn(),
  getQuickBooksCustomers: jest.fn(),
  handleQuickBooksCallback: jest.fn(),
  quickBooksAuthUrl: jest.fn(),
  quickBooksDisconnect: jest.fn(),
  quickBooksStatus: jest.fn(),
  refreshQuickBooksCustomerSyncStatus: jest.fn(),
}));
jest.mock('../controllers/quickbooksWebhookController', () => ({ quickBooksInvoicePaidWebhook: jest.fn() }));
jest.mock('../api/simulate-payment', () => ({ simulatePaymentController: jest.fn() }));
jest.mock('../services/contractClientService', () => ({ ContractClientService: jest.fn() }));
jest.mock('../services/simplePaymentService', () => ({ SimplePaymentService: jest.fn() }));
jest.mock('../services/cloudSqlDoulaAssignmentService', () => ({ CloudSqlDoulaAssignmentService: jest.fn() }));
jest.mock('../repositories/cloudSqlPaymentRepository', () => ({ listPaymentsFromCloudSql: jest.fn() }));

import contractRoutes from '../routes/contractRoutes';
import contractSigningRoutes from '../routes/contractSigningRoutes';
import customersRoutes from '../routes/customersRoutes';
import paymentRoutes from '../routes/paymentRoutes';
import quickBooksRoutes from '../routes/quickbooksRoutes';
import signNowRoutes from '../routes/signNowRoutes';

const appFor = (prefix: string, router: express.Router) => {
  const app = express();
  app.use(express.json());
  app.use(prefix, router);
  return app;
};

describe('AUTH-01B public route protection', () => {
  it.each([
    ['/api/contract', contractRoutes, 'post', '/postpartum/calculate'],
    ['/api/contract-signing', contractSigningRoutes, 'get', '/test-auth'],
    ['/quickbooks/customers', customersRoutes, 'get', '/invoiceable'],
    ['/quickbooks', quickBooksRoutes, 'get', '/status'],
    ['/api/payments', paymentRoutes, 'get', '/dashboard'],
    ['/api/signnow', signNowRoutes, 'post', '/test-auth'],
  ] as const)('returns 401 for unauthenticated %s operational routes', async (prefix, router, method, path) => {
    await (request(appFor(prefix, router))[method] as (path: string) => request.Test)(`${prefix}${path}`).expect(401);
  });

  it.each([
    ['/api/contract', contractRoutes, 'post', '/postpartum/calculate', 'client'],
    ['/api/contract-signing', contractSigningRoutes, 'get', '/test-auth', 'client'],
    ['/quickbooks/customers', customersRoutes, 'get', '/invoiceable', 'doula'],
    ['/quickbooks', quickBooksRoutes, 'get', '/status', 'doula'],
    ['/api/payments', paymentRoutes, 'get', '/dashboard', 'client'],
    ['/api/signnow', signNowRoutes, 'post', '/test-auth', 'client'],
  ] as const)('returns 403 for unauthorized authenticated %s routes', async (prefix, router, method, path, role) => {
    await (request(appFor(prefix, router))[method] as (path: string) => request.Test)(`${prefix}${path}`)
      .set('x-test-role', role)
      .expect(403);
  });

  it('keeps the SignNow provider callback outside user authentication', async () => {
    await request(appFor('/api/signnow', signNowRoutes))
      .post('/api/signnow/callback')
      .send({ synthetic: true })
      .expect(204);
  });
});
