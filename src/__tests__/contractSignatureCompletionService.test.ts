jest.mock('../db/cloudSqlPool', () => ({
  queryCloudSql: jest.fn(),
}));

jest.mock('../services/invoice/createInvoice', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('../services/portalEligibilityService', () => ({
  portalEligibilityService: {
    computeAndPersist: jest.fn(),
  },
}));

import { queryCloudSql } from '../db/cloudSqlPool';
import createInvoiceService from '../services/invoice/createInvoice';
import { portalEligibilityService } from '../services/portalEligibilityService';
import { contractSignatureCompletionService } from '../services/contractSignatureCompletionService';

describe('ContractSignatureCompletionService', () => {
  const contractId = 'contract-1';
  const clientId = 'client-1';
  const documentId = 'doc-1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('marks a completed contract signed and creates the deposit invoice once', async () => {
    (queryCloudSql as jest.Mock)
      .mockResolvedValueOnce({
        rows: [{ contract_id: contractId, client_id: clientId, status: 'pending_signature' }],
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [{ id: 'inst-1', amount: '150.00', due_date: '2026-07-08', qbo_invoice_id: null }],
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });

    (portalEligibilityService.computeAndPersist as jest.Mock).mockResolvedValue({
      deposit_paid: false,
      primary_portal_blocker: 'deposit_unpaid',
    });

    (createInvoiceService as jest.Mock).mockResolvedValue({
      Id: 'qbo-inv-1',
      invoiceLink: 'https://pay.example/deposit',
    });

    const result = await contractSignatureCompletionService.finalizeSignedDocument(documentId);

    expect(portalEligibilityService.computeAndPersist).toHaveBeenCalledWith(clientId, {
      force_contract_signed: true,
      event_source: 'signnow_status_sync',
    });
    expect(createInvoiceService).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'system-contract-signature',
        internalCustomerId: clientId,
      })
    );
    expect(queryCloudSql).toHaveBeenLastCalledWith(
      expect.stringContaining('UPDATE public.payment_installments'),
      ['inst-1', 'qbo-inv-1']
    );
    expect(result).toEqual(
      expect.objectContaining({
        contract_id: contractId,
        client_id: clientId,
        contract_marked_signed: true,
        deposit_invoice_created: true,
        deposit_invoice_id: 'qbo-inv-1',
        payment_link: 'https://pay.example/deposit',
      })
    );
  });

  it('does not create a duplicate invoice when the deposit installment is already linked', async () => {
    (queryCloudSql as jest.Mock)
      .mockResolvedValueOnce({
        rows: [{ contract_id: contractId, client_id: clientId, status: 'signed' }],
      })
      .mockResolvedValueOnce({
        rows: [{ id: 'inst-1', amount: '150.00', due_date: '2026-07-08', qbo_invoice_id: 'qbo-inv-1' }],
      });

    (portalEligibilityService.computeAndPersist as jest.Mock).mockResolvedValue({
      deposit_paid: false,
      primary_portal_blocker: 'deposit_unpaid',
    });

    const result = await contractSignatureCompletionService.finalizeSignedDocument(documentId);

    expect(createInvoiceService).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        contract_marked_signed: false,
        deposit_invoice_created: false,
        deposit_invoice_id: 'qbo-inv-1',
        reason: 'deposit_invoice_exists',
      })
    );
  });
});
