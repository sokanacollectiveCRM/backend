let currentUser:
  | { id: string; role: string; email: string }
  | null = { id: 'billing-user-id', role: 'billing', email: 'billing@sokanacollective.com' };

jest.mock('../middleware/authMiddleware', () => ({
  __esModule: true,
  default: (req: any, res: any, next: any) => {
    if (!currentUser) {
      res.status(401).json({ error: 'No session token provided' });
      return;
    }
    req.user = currentUser;
    next();
  },
}));

jest.mock('../services/limitedBillingContractsService', () => ({
  listLimitedBillingContracts: jest.fn(),
  getLimitedBillingContractById: jest.fn(),
}));

jest.mock('../services/billingReminderService', () => ({
  sendBillingReminderEmail: jest.fn(),
  BillingReminderValidationError: class BillingReminderValidationError extends Error {
    status: number;
    code: string;
    constructor(message: string, status: number, code: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
}));

import express from 'express';
import request from 'supertest';
import billingRoutes from '../routes/billingRoutes';
import {
  getLimitedBillingContractById,
  listLimitedBillingContracts,
} from '../services/limitedBillingContractsService';
import { sendBillingReminderEmail } from '../services/billingReminderService';

describe('billing routes', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/billing', billingRoutes);

  beforeEach(() => {
    jest.clearAllMocks();
    currentUser = { id: 'billing-user-id', role: 'billing', email: 'billing@sokanacollective.com' };
  });

  it('allows billing role to access GET /api/billing/contracts', async () => {
    (listLimitedBillingContracts as jest.Mock).mockResolvedValue([
      {
        contractId: 'contract-1',
        clientName: 'Jane Doe',
        contractType: 'Labor Support',
        contractStatus: 'signed',
        totalAmount: 2400,
        installmentCount: 3,
        paymentSchedule: 'Labor Support Payment Plan',
        nextDueDate: '2026-06-20',
        invoiceStatus: 'open',
        quickBooksSyncStatus: 'synced',
      },
    ]);

    const response = await request(app).get('/api/billing/contracts').expect(200);
    expect(response.body.success).toBe(true);
    expect(response.body.meta).toMatchObject({ count: 1 });
    expect(response.body.data[0]).toMatchObject({
      contractId: 'contract-1',
      clientName: 'Jane Doe',
      contractType: 'Labor Support',
      contractStatus: 'signed',
      totalAmount: 2400,
      installmentCount: 3,
      paymentSchedule: 'Labor Support Payment Plan',
      nextDueDate: '2026-06-20',
      invoiceStatus: 'open',
      quickBooksSyncStatus: 'synced',
    });
    expect(response.body.data[0].health_history).toBeUndefined();
    expect(response.body.data[0].demographics).toBeUndefined();
  });

  it('allows billing role to access GET /api/billing/contracts/:contractId', async () => {
    (getLimitedBillingContractById as jest.Mock).mockResolvedValue({
      contractId: 'contract-1',
      clientName: 'Jane Doe',
      contractType: 'Labor Support',
      contractStatus: 'signed',
      totalAmount: 2400,
      depositAmount: 600,
      installmentCount: 3,
      paymentSchedule: 'Labor Support Payment Plan',
      installments: [
        {
          installmentNumber: 1,
          dueDate: '2026-06-20',
          amount: 600,
          status: 'pending',
          paidDate: null,
          invoiceId: null,
          invoiceStatus: null,
        },
      ],
      invoiceStatus: 'open',
      quickBooksSyncStatus: 'synced',
      createdAt: '2026-06-10T00:00:00.000Z',
      sentAt: '2026-06-10T01:00:00.000Z',
      signedAt: '2026-06-10T02:00:00.000Z',
      limitedViewUrl: 'https://crm.example.com/billing/contracts/contract-1',
    });

    const response = await request(app).get('/api/billing/contracts/contract-1').expect(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      contractId: 'contract-1',
      clientName: 'Jane Doe',
      contractType: 'Labor Support',
      contractStatus: 'signed',
      totalAmount: 2400,
      depositAmount: 600,
      installmentCount: 3,
      paymentSchedule: 'Labor Support Payment Plan',
      invoiceStatus: 'open',
      quickBooksSyncStatus: 'synced',
    });
    expect(response.body.data.installments).toHaveLength(1);
    expect(response.body.data.health_history).toBeUndefined();
    expect(response.body.data.pregnancy_number).toBeUndefined();
  });

  it('blocks non-admin non-billing users', async () => {
    currentUser = { id: 'doula-user-id', role: 'doula', email: 'doula@example.com' };
    await request(app).get('/api/billing/contracts').expect(403);
  });

  it('allows billing role to send reminder emails', async () => {
    (sendBillingReminderEmail as jest.Mock).mockResolvedValue({
      emailSent: true,
      sentAt: '2026-06-11T18:30:00.000Z',
      contractId: 'contract-1',
      recipient: 'client@example.com',
      templateKey: 'past_due',
    });

    const response = await request(app)
      .post('/api/billing/contracts/contract-1/reminder-email')
      .send({
        installmentNumber: 2,
        templateKey: 'past_due',
        subject: 'Reminder: payment overdue',
        message: 'Please update your payment method.',
      })
      .expect(200);

    expect(sendBillingReminderEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        senderUserId: 'billing-user-id',
        senderRole: 'billing',
        contractId: 'contract-1',
        installmentNumber: 2,
        templateKey: 'past_due',
      })
    );
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      emailSent: true,
      contractId: 'contract-1',
      recipient: 'client@example.com',
      templateKey: 'past_due',
    });
  });

  it('returns 401 when unauthenticated', async () => {
    currentUser = null;
    await request(app).get('/api/billing/contracts').expect(401);
  });
});
