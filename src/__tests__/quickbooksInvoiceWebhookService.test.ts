jest.mock('../db/cloudSqlPool', () => ({
  getPool: jest.fn(),
  queryCloudSql: jest.fn(),
}));

jest.mock('../utils/qboClient', () => ({
  qboRequest: jest.fn(),
}));

jest.mock('../repositories/cloudSqlInvoiceWriteRepository', () => ({
  upsertInvoiceToCloudSql: jest.fn(),
}));

jest.mock('../services/portalEligibilityService', () => ({
  portalEligibilityService: {
    getOnboardingGates: jest.fn(),
    computeAndPersist: jest.fn(),
  },
}));

jest.mock('../services/payments/listQuickBooksStoredPaymentMethods', () => ({
  getPrimaryQuickBooksStoredPaymentMethod: jest.fn(),
}));

import { getPool } from '../db/cloudSqlPool';
import { upsertInvoiceToCloudSql } from '../repositories/cloudSqlInvoiceWriteRepository';
import { clientOnboardingReadinessRepository } from '../repositories/cloudSqlClientOnboardingReadinessRepository';
import { portalEligibilityService } from '../services/portalEligibilityService';
import { getPrimaryQuickBooksStoredPaymentMethod } from '../services/payments/listQuickBooksStoredPaymentMethods';
import { quickbooksInvoiceWebhookService } from '../services/quickbooksInvoiceWebhookService';

describe('QuickBooks invoice webhook service', () => {
  const clientId = '123e4567-e89b-12d3-a456-426614174000';
  const qboInvoiceId = 'inv-100';

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(clientOnboardingReadinessRepository, 'getByClientId').mockResolvedValue(null);
    jest.spyOn(clientOnboardingReadinessRepository, 'getByVerificationInvoiceId').mockResolvedValue(null);
    jest.spyOn(clientOnboardingReadinessRepository, 'recordEvent').mockResolvedValue(undefined);
    (upsertInvoiceToCloudSql as jest.Mock).mockResolvedValue(undefined);
    (getPool as jest.Mock).mockReturnValue({
      query: jest.fn().mockResolvedValue({ rows: [{ client_id: clientId }] }),
    });
  });

  it('marks deposit paid and flags missing card for insurance clients', async () => {
    (portalEligibilityService.getOnboardingGates as jest.Mock).mockResolvedValue({
      billing_path: 'insurance',
      qb_customer_id: 'qb-cust-1',
    });
    (getPrimaryQuickBooksStoredPaymentMethod as jest.Mock).mockResolvedValue(null);
    (portalEligibilityService.computeAndPersist as jest.Mock).mockResolvedValue({
      is_eligible: false,
      primary_portal_blocker: 'missing_card_on_file',
    });

    (getPool as jest.Mock).mockReturnValue({
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ client_id: clientId }] })
        .mockResolvedValueOnce({ rows: [{ is_deposit: true }] }),
    });

    await quickbooksInvoiceWebhookService.handleInvoicePaid({
      qbo_invoice_id: qboInvoiceId,
      balance: 0,
      client_id: clientId,
    });

    expect(portalEligibilityService.computeAndPersist).toHaveBeenCalledWith(clientId, {
      force_deposit_paid: true,
      event_source: 'quickbooks_webhook',
    });
    expect(clientOnboardingReadinessRepository.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'quickbooks_card_missing' })
    );
  });

  it('confirms card on file when deposit is paid and QB has stored method', async () => {
    (portalEligibilityService.getOnboardingGates as jest.Mock).mockResolvedValue({
      billing_path: 'self_pay',
      qb_customer_id: 'qb-cust-1',
    });
    (getPrimaryQuickBooksStoredPaymentMethod as jest.Mock).mockResolvedValue({ id: 'pm-123' });
    (portalEligibilityService.computeAndPersist as jest.Mock).mockResolvedValue({
      is_eligible: true,
    });

    (getPool as jest.Mock).mockReturnValue({
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ client_id: clientId }] })
        .mockResolvedValueOnce({ rows: [{ is_deposit: true }] }),
    });

    await quickbooksInvoiceWebhookService.handleInvoicePaid({
      qbo_invoice_id: qboInvoiceId,
      balance: 0,
      client_id: clientId,
    });

    expect(clientOnboardingReadinessRepository.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'card_on_file_confirmed' })
    );
  });

  it('clears missing card blocker when verification invoice is paid with stored method', async () => {
    jest.spyOn(clientOnboardingReadinessRepository, 'getByClientId').mockResolvedValue({
      id: 'readiness-1',
      client_id: clientId,
      verification_invoice_id: qboInvoiceId,
      is_eligible: false,
    } as any);

    (portalEligibilityService.getOnboardingGates as jest.Mock).mockResolvedValue({
      billing_path: 'insurance',
      qb_customer_id: 'qb-cust-1',
    });
    (getPrimaryQuickBooksStoredPaymentMethod as jest.Mock).mockResolvedValue({ id: 'pm-999' });
    (portalEligibilityService.computeAndPersist as jest.Mock).mockResolvedValue({
      is_eligible: true,
    });

    await quickbooksInvoiceWebhookService.handleInvoicePaid({
      qbo_invoice_id: qboInvoiceId,
      balance: 0,
      client_id: clientId,
    });

    expect(clientOnboardingReadinessRepository.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'verification_invoice_paid' })
    );
    expect(portalEligibilityService.computeAndPersist).toHaveBeenCalledWith(
      clientId,
      expect.objectContaining({ verification_invoice_paid_at: expect.any(String) })
    );
  });
});
