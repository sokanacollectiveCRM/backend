import express from 'express';
import request from 'supertest';

import { queryCloudSql } from '../db/cloudSqlPool';
import { nativeContractService } from '../features/contracts/composition';
import contractSigningRoutes from '../routes/contractSigningRoutes';
import { processContractWithSignNow } from '../utils/signNowContractProcessor';

jest.mock('../middleware/authMiddleware', () => ({
  __esModule: true,
  default: (req: any, _res: any, next: any) => {
    req.user = {
      id: 'admin-user',
      role: 'admin',
      email: 'admin@example.test',
    };
    next();
  },
}));
jest.mock('../db/cloudSqlPool', () => ({ queryCloudSql: jest.fn() }));
jest.mock('../features/contracts/composition', () => ({
  nativeContractService: {
    createLegacyDraft: jest.fn(),
    send: jest.fn(),
  },
}));
jest.mock('../utils/signNowContractProcessor', () => ({
  processContractWithSignNow: jest.fn(),
  checkSignNowDocumentStatus: jest.fn(),
}));
jest.mock('../services/signNowService', () => ({
  SignNowService: jest.fn(),
}));

const mockedQueryCloudSql = queryCloudSql as jest.Mock;
const mockedCreateLegacyDraft =
  nativeContractService.createLegacyDraft as jest.Mock;
const mockedSend = nativeContractService.send as jest.Mock;
const mockedProcessContractWithSignNow =
  processContractWithSignNow as jest.Mock;

describe('legacy contract generation compatibility adapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NATIVE_CONTRACTS_ENABLED = 'true';
    mockedQueryCloudSql.mockResolvedValue({
      rows: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          first_name: 'Client',
          last_name: 'Signer',
          email: 'client@example.test',
        },
      ],
    });
    mockedCreateLegacyDraft.mockResolvedValue({
      id: '22222222-2222-4222-8222-222222222222',
    });
    mockedSend.mockResolvedValue({
      id: '22222222-2222-4222-8222-222222222222',
    });
  });

  it('creates and sends natively without invoking SignNow', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/contract-signing', contractSigningRoutes);

    const response = await request(app)
      .post('/api/contract-signing/generate-contract')
      .send({
        clientName: 'Client Signer',
        clientEmail: 'client@example.test',
        serviceType: 'Labor Support Services',
        totalInvestment: '$1,000.00',
        depositAmount: '$200.00',
        selectedServices: [
          { id: 'labor', name: 'Labor', type: 'flat', amount: 1000 },
        ],
      })
      .expect(200);

    expect(mockedProcessContractWithSignNow).not.toHaveBeenCalled();
    expect(mockedCreateLegacyDraft).toHaveBeenCalledTimes(1);
    expect(mockedSend).toHaveBeenCalledTimes(1);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        contractId: '22222222-2222-4222-8222-222222222222',
        docxPath: '',
        pdfPath: '',
        signNow: {
          documentId: '',
          invitationSent: true,
        },
        emailDelivery: {
          provider: 'native',
          sent: true,
        },
      },
    });
  });

  it('uses the selected Cloud SQL client ID when the frontend provides it', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/contract-signing', contractSigningRoutes);
    const clientId = '11111111-1111-4111-8111-111111111111';

    await request(app)
      .post('/api/contract-signing/generate-contract')
      .send({
        clientId,
        clientName: 'Client Signer',
        clientEmail: 'client@example.test',
        serviceType: 'Labor Support Services',
        selectedServices: [
          { id: 'labor', name: 'Labor', type: 'flat', amount: 1000 },
        ],
      })
      .expect(200);

    expect(mockedQueryCloudSql).toHaveBeenCalledWith(
      expect.stringContaining('WHERE id = $1::uuid'),
      [clientId]
    );
  });
});
