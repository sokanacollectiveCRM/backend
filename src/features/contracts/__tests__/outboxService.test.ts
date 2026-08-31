import { ContractOutboxService } from '../services/outboxService';

jest.mock('../../../db/cloudSqlPool', () => ({
  queryCloudSql: jest.fn(),
}));
jest.mock('../../../services/contractSignatureCompletionService', () => ({
  contractSignatureCompletionService: {
    finalizeSignedContract: jest.fn(),
  },
}));
jest.mock('../../../services/portalEligibilityService', () => ({
  portalEligibilityService: {
    computeAndPersist: jest.fn(),
  },
}));
jest.mock('../../../services/gcs/documentStorage', () => ({
  downloadObject: jest.fn(),
}));

describe('ContractOutboxService', () => {
  it('processes billing notifications without invitation secrets', async () => {
    const sendContractInitiatedBillingEmail = jest
      .fn()
      .mockResolvedValue(undefined);
    const service = new ContractOutboxService(
      {} as any,
      { sendContractInitiatedBillingEmail } as any
    );
    const payload = {
      contractId: '6f452b33-c4a1-4546-8c35-6ba79d46af58',
      clientId: 'f518ab41-ee44-45f2-ab93-dc69cf6a13bc',
      clientName: 'Client',
      serviceType: 'Labor Support Services',
      totalCents: 100000,
      depositCents: 20000,
      installmentCount: 3,
    };

    await service.handle({
      id: '3d380f16-16a8-4aa6-9a94-c0f886341cc8',
      contractId: payload.contractId,
      clientId: payload.clientId,
      type: 'billing_notification',
      idempotencyKey: 'billing-email',
      payload,
      attemptCount: 1,
      maxAttempts: 10,
    });

    expect(sendContractInitiatedBillingEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        contractId: payload.contractId,
        installmentCount: 3,
      })
    );
    expect(payload).not.toHaveProperty('token');
  });
});
