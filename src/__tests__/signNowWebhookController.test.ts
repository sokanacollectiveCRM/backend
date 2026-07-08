jest.mock('../services/contractSignatureCompletionService', () => ({
  contractSignatureCompletionService: {
    finalizeSignedDocument: jest.fn(),
  },
}));

import { signNowCallback } from '../controllers/signNowWebhookController';
import { contractSignatureCompletionService } from '../services/contractSignatureCompletionService';

describe('signNowCallback', () => {
  const createRes = () => {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('processes signed/completed callbacks and finalizes the contract workflow', async () => {
    (contractSignatureCompletionService.finalizeSignedDocument as jest.Mock).mockResolvedValue({
      contract_id: 'contract-1',
      deposit_invoice_created: true,
    });

    const req: any = {
      body: {
        event: 'document.completed',
        document_id: 'doc-1',
      },
    };
    const res = createRes();
    const next = jest.fn();

    await signNowCallback(req, res, next);

    expect(contractSignatureCompletionService.finalizeSignedDocument).toHaveBeenCalledWith('doc-1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        received: true,
        processed: true,
        documentId: 'doc-1',
      })
    );
  });

  it('acknowledges non-completion events without triggering automation', async () => {
    const req: any = {
      body: {
        event: 'document.viewed',
        document: { id: 'doc-2' },
      },
    };
    const res = createRes();
    const next = jest.fn();

    await signNowCallback(req, res, next);

    expect(contractSignatureCompletionService.finalizeSignedDocument).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      received: true,
      processed: false,
      reason: 'event_not_actionable',
      documentId: 'doc-2',
    });
  });

  it('rejects callbacks that do not include a document id', async () => {
    const req: any = {
      body: {
        event: 'document.completed',
      },
    };
    const res = createRes();
    const next = jest.fn();

    await signNowCallback(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Missing SignNow document id' });
  });
});
