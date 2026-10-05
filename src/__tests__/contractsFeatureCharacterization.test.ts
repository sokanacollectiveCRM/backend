import express from 'express';
import request from 'supertest';

import { queryCloudSql } from '../db/cloudSqlPool';
import { ContractController } from '../features/contracts/controllers/contractController';
import { SigningController } from '../features/contracts/controllers/signingController';
import { createAdminContractRoutes } from '../features/contracts/routes/adminContractRoutes';
import { createClientContractRoutes } from '../features/contracts/routes/clientContractRoutes';
import { createSigningRoutes } from '../features/contracts/routes/signingRoutes';
import {
  ContractConflictError,
  ContractNotFoundError,
  ContractService,
} from '../features/contracts/services/contractService';
import { SigningSessionService } from '../features/contracts/services/signingSessionService';
import contractRoutes from '../routes/contractRoutes';
import contractSigningRoutes from '../routes/contractSigningRoutes';

jest.mock('../middleware/authMiddleware', () => ({
  __esModule: true,
  default: (req: any, res: any, next: any) => {
    const role = req.get('x-test-role');
    if (!role) return res.status(401).json({ error: 'Unauthorized' });
    req.user = { id: `${role}-user`, role, email: `${role}@example.test` };
    return next();
  },
}));
jest.mock('../db/cloudSqlPool', () => ({ queryCloudSql: jest.fn() }));
jest.mock('../features/contracts/composition', () => ({
  nativeContractService: {
    createLegacyDraft: jest.fn(),
    send: jest.fn(),
  },
}));

const mockedQueryCloudSql = queryCloudSql as jest.Mock;

describe('legacy generate-contract compatibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NATIVE_CONTRACTS_ENABLED = 'true';
  });

  function app() {
    const server = express();
    server.use(express.json());
    server.use('/api/contract-signing', contractSigningRoutes);
    return server;
  }

  it('returns 400 when clientName or clientEmail is missing', async () => {
    const response = await request(app())
      .post('/api/contract-signing/generate-contract')
      .set('x-test-role', 'admin')
      .send({ clientName: 'Only Name' })
      .expect(400);

    expect(response.body).toEqual({
      success: false,
      error: 'clientName and clientEmail are required',
    });
    expect(mockedQueryCloudSql).not.toHaveBeenCalled();
  });

  it('returns 404 Client not found when Cloud SQL has no match', async () => {
    mockedQueryCloudSql.mockResolvedValue({ rows: [] });

    const response = await request(app())
      .post('/api/contract-signing/generate-contract')
      .set('x-test-role', 'admin')
      .send({
        clientName: 'Client Signer',
        clientEmail: 'missing@example.test',
      })
      .expect(404);

    expect(response.body).toEqual({
      success: false,
      error: 'Client not found',
    });
  });

  it('returns 503 when native contract creation is disabled', async () => {
    process.env.NATIVE_CONTRACTS_ENABLED = 'false';

    const response = await request(app())
      .post('/api/contract-signing/generate-contract')
      .set('x-test-role', 'admin')
      .send({
        clientName: 'Client Signer',
        clientEmail: 'client@example.test',
      })
      .expect(503);

    expect(response.body).toEqual({
      success: false,
      error: 'Native contract creation is disabled',
    });
  });
});

describe('legacy postpartum contract routes', () => {
  function app() {
    const server = express();
    server.use(express.json());
    server.use('/api/contract', contractRoutes);
    return server;
  }

  it('returns 400 with the calculator validation string', async () => {
    const response = await request(app())
      .post('/api/contract/postpartum/calculate')
      .set('x-test-role', 'admin')
      .send({
        total_hours: 0,
        hourly_rate: 50,
        installments_count: 3,
        deposit_type: 'percent',
        deposit_value: 20,
      })
      .expect(400);

    expect(response.body).toEqual({
      success: false,
      error: 'Total hours must be greater than 0',
    });
  });

  it('keeps postpartum send retired at 410', async () => {
    const response = await request(app())
      .post('/api/contract/postpartum/send')
      .set('x-test-role', 'admin')
      .send({})
      .expect(410);

    expect(response.body).toEqual({
      success: false,
      error: 'Use the native contract signing flow.',
    });
  });
});

describe('native contract HTTP wrappers', () => {
  it('wraps an admin draft in { contract } with 201', async () => {
    const contracts = {
      createDraft: jest.fn().mockResolvedValue({ id: 'contract-1' }),
    };
    const controller = new ContractController(contracts as any);
    const app = express();
    app.use(express.json());
    app.use('/api/contracts', createAdminContractRoutes(controller));

    const response = await request(app)
      .post('/api/contracts/drafts')
      .set('x-test-role', 'admin')
      .send({
        templateId: 'labor_support',
        clientId: '11111111-1111-4111-8111-111111111111',
        clientName: 'Client Signer',
        clientEmail: 'client@example.test',
        serviceType: 'Labor Support Services',
        selectedServices: [
          { id: 'labor', name: 'Labor', type: 'flat', amount: 1000 },
        ],
      })
      .expect(201);

    expect(response.body).toEqual({ contract: { id: 'contract-1' } });
  });

  it('returns 404 Client not found when the auth user is not a client', async () => {
    const controller = new ContractController({} as any, {
      getClientIdByAuthUserId: jest.fn().mockResolvedValue(null),
    });
    const app = express();
    app.use('/api/clients', createClientContractRoutes(controller));

    const response = await request(app)
      .get('/api/clients/me/contracts')
      .set('x-test-role', 'client')
      .expect(404);

    expect(response.body).toEqual({ error: 'Client not found' });
  });

  it('keeps the legacy signing-link 410 body and code', async () => {
    const controller = new SigningController({} as any, {} as any);
    const app = express();
    app.use('/signing', createSigningRoutes(controller));

    const response = await request(app).get('/signing/old-token').expect(410);

    expect(response.body).toEqual({
      error:
        'This signing link format is no longer supported. Open the link from your email again or request a new invitation.',
      code: 'LEGACY_SIGNING_ROUTE',
    });
    expect(response.headers['cache-control']).toBe('no-store');
  });
});

describe('native contract send and signing rules', () => {
  function snapshot() {
    return {
      client: { name: 'Client', email: 'client@example.test' },
      serviceType: 'Labor Support Services',
      pricing: { installmentCents: [100] },
    };
  }

  it('rejects send from a non-draft status with the same 409 string', async () => {
    const service = new ContractService(
      {
        findById: jest.fn().mockResolvedValue({
          id: 'contract-1',
          status: 'signed',
          snapshot: snapshot(),
        }),
      } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      'https://crm.test/signing'
    );

    await expect(
      service.send('contract-1', 'admin-user')
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'Contract cannot be sent from its current status',
    });
  });

  it('rejects resend unless the contract is already active', async () => {
    const service = new ContractService(
      {
        findById: jest.fn().mockResolvedValue({
          id: 'contract-1',
          status: 'draft',
          snapshot: snapshot(),
        }),
      } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      'https://crm.test/signing'
    );

    await expect(
      service.send('contract-1', 'admin-user', true)
    ).rejects.toBeInstanceOf(ContractConflictError);
    await expect(
      service.send('contract-1', 'admin-user', true)
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'Only an active contract can be resent',
    });
  });

  it('uses Contract not found for a missing download', async () => {
    const service = new ContractService(
      { findById: jest.fn().mockResolvedValue(null) } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      'https://crm.test/signing'
    );

    await expect(service.getDownload('missing')).rejects.toBeInstanceOf(
      ContractNotFoundError
    );
    await expect(service.getDownload('missing')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Contract not found',
    });
  });

  it('requires consent, initials, and a valid signature before finalize', async () => {
    const sessions = {
      getContract: jest.fn().mockResolvedValue({
        id: 'contract-1',
        clientId: 'client-1',
        signingManifest: [{ id: 'sig', required: true }],
      }),
    };
    const signing = new SigningSessionService(
      {} as any,
      sessions as any,
      { assertAllowed: jest.fn() } as any,
      { finalize: jest.fn() } as any,
      { signedReadUrl: jest.fn(), download: jest.fn() } as any
    );

    await expect(
      signing.complete(
        {
          sessionId: 'session',
          invitationId: 'invite',
          contractId: 'contract-1',
          clientId: 'client-1',
          invitationExpiresAt: new Date(Date.now() + 60_000),
          sessionExpiresAt: new Date(Date.now() + 60_000),
        },
        {
          initials: '',
          consent: false,
          signature: { type: 'typed', text: '' },
          completedFieldIds: [],
        }
      )
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Signer name, initials, and consent are required',
    });
  });
});
