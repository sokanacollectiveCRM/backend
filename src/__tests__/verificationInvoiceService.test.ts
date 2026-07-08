jest.mock('../db/cloudSqlPool', () => ({
  getPool: jest.fn(),
}));

jest.mock('../services/invoice/createInvoiceInQuickBooks', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('../services/invoice/buildInvoicePayload', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('../repositories/cloudSqlInvoiceWriteRepository', () => ({
  upsertInvoiceToCloudSql: jest.fn(),
}));

jest.mock('../services/portalEligibilityService', () => ({
  portalEligibilityService: {
    getPortalEligibility: jest.fn(),
    computeAndPersist: jest.fn(),
  },
}));

import { getPool } from '../db/cloudSqlPool';
import createInvoiceInQuickBooks from '../services/invoice/createInvoiceInQuickBooks';
import buildInvoicePayload from '../services/invoice/buildInvoicePayload';
import { upsertInvoiceToCloudSql } from '../repositories/cloudSqlInvoiceWriteRepository';
import { portalEligibilityService } from '../services/portalEligibilityService';
import { clientOnboardingReadinessRepository } from '../repositories/cloudSqlClientOnboardingReadinessRepository';
import { verificationInvoiceService } from '../services/verificationInvoiceService';

describe('verification invoice service', () => {
  const clientId = '123e4567-e89b-12d3-a456-426614174000';

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(clientOnboardingReadinessRepository, 'recordEvent').mockResolvedValue(undefined);
    (getPool as jest.Mock).mockReturnValue({
      query: jest.fn().mockResolvedValue({
        rows: [
          {
            id: clientId,
            qbo_customer_id: 'qb-cust-1',
            email: 'client@example.com',
            payment_method: 'Self-Pay',
          },
        ],
      }),
    });
    (portalEligibilityService.getPortalEligibility as jest.Mock).mockResolvedValue({
      primary_portal_blocker: 'missing_card_on_file',
      billing_path: 'self_pay',
    });
    (buildInvoicePayload as jest.Mock).mockReturnValue({ CustomerRef: { value: 'qb-cust-1' } });
    (createInvoiceInQuickBooks as jest.Mock).mockResolvedValue({
      Id: 'verify-inv-1',
      invoiceLink: 'https://pay.example/verify',
    });
    (upsertInvoiceToCloudSql as jest.Mock).mockResolvedValue(undefined);
    (portalEligibilityService.computeAndPersist as jest.Mock).mockResolvedValue({});
  });

  it('creates a $1 verification invoice for missing-card clients', async () => {
    const result = await verificationInvoiceService.sendVerificationInvoice(clientId, 'staff-1');

    expect(buildInvoicePayload).toHaveBeenCalledWith(
      'qb-cust-1',
      expect.objectContaining({
        lineItems: [
          expect.objectContaining({
            Amount: 1,
          }),
        ],
      })
    );
    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        verification_invoice_id: 'verify-inv-1',
        payment_link: 'https://pay.example/verify',
      })
    );
    expect(clientOnboardingReadinessRepository.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'verification_invoice_sent' })
    );
  });

  it('rejects clients not blocked by missing_card_on_file', async () => {
    (portalEligibilityService.getPortalEligibility as jest.Mock).mockResolvedValue({
      primary_portal_blocker: 'deposit_unpaid',
      billing_path: 'self_pay',
    });

    await expect(
      verificationInvoiceService.sendVerificationInvoice(clientId, 'staff-1')
    ).rejects.toThrow('missing_card_on_file');
  });
});
