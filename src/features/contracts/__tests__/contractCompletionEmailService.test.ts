import { ContractCompletionEmailService } from '../services/contractCompletionEmailService';

jest.mock('../../../services/gcs/documentStorage', () => ({
  downloadObject: jest.fn().mockResolvedValue(Buffer.from('pdf')),
}));

describe('ContractCompletionEmailService', () => {
  it('sends the client signed copy and admin notification together', async () => {
    const sendSignedContractCopy = jest.fn().mockResolvedValue(undefined);
    const sendAdminContractSignedNotification = jest
      .fn()
      .mockResolvedValue(undefined);
    const service = new ContractCompletionEmailService({
      sendSignedContractCopy,
      sendAdminContractSignedNotification,
    });

    await service.deliver({
      contractId: 'contract-123',
      clientName: 'Jane Doe',
      clientEmail: 'jane@example.com',
      serviceType: 'Labor Support Services',
      totalCents: 200_000,
      signedDocumentPath: 'contracts/contract-123/completed/hash.pdf',
      signedAt: new Date('2026-08-31T00:00:00.000Z'),
    });

    expect(sendSignedContractCopy).toHaveBeenCalledWith(
      expect.objectContaining({
        clientEmail: 'jane@example.com',
        contractId: 'contract-123',
      })
    );
    expect(sendAdminContractSignedNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        clientName: 'Jane Doe',
        contractType: 'Labor Support Services',
        contractId: 'contract-123',
        contractTotal: '$2,000.00',
      })
    );
  });
});
