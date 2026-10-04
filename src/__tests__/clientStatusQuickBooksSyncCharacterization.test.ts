/**
 * Characterization for PUT /clients/status and the backend QuickBooks
 * customer link it triggers. Pins behavior before the clients feature move.
 */
import { Response } from 'express';

import { ClientController } from '../controllers/clientController';
import { queryCloudSql } from '../db/cloudSqlPool';
import { CloudSqlClientRepository } from '../repositories/cloudSqlClientRepository';
import { ClientRepository } from '../repositories/interface/clientRepository';
import { syncMatchedClientToQuickBooks } from '../services/customer/syncMatchedClientToQuickBooks';
import { AuthRequest, ROLE } from '../types';
import { ClientUseCase } from '../usecase/clientUseCase';

jest.mock('../db/cloudSqlPool', () => ({
  getPool: jest.fn(),
  queryCloudSql: jest.fn(),
}));
jest.mock('../services/customer/syncMatchedClientToQuickBooks', () => ({
  syncMatchedClientToQuickBooks: jest.fn(),
}));
jest.mock('../services/portalEligibilityService', () => ({
  portalEligibilityService: {
    getPortalEligibility: jest.fn().mockResolvedValue(null),
  },
}));

const clientId = '123e4567-e89b-12d3-a456-426614174000';

const row = {
  id: clientId,
  first_name: 'Jane',
  last_name: 'Client',
  email: 'jane@example.com',
  status: 'matched',
  qbo_customer_id: 'QB-OLD',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const syncMock = syncMatchedClientToQuickBooks as jest.Mock;
const queryMock = queryCloudSql as jest.Mock;

function flushPromises() {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('PUT /clients/status characterization', () => {
  let controller: ClientController;
  let repo: jest.Mocked<ClientRepository>;
  let res: Partial<Response>;

  function request(body: Record<string, unknown>): AuthRequest {
    return {
      body,
      user: { id: 'admin-id', role: ROLE.ADMIN },
    } as unknown as AuthRequest;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SPLIT_DB_READ_MODE = 'primary';
    repo = {
      updateClientStatusCanonical: jest
        .fn()
        .mockImplementation(async (_id: string, status: string) => ({
          ...row,
          status,
        })),
    } as unknown as jest.Mocked<ClientRepository>;
    controller = new ClientController({} as ClientUseCase, {}, repo);
    res = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
    };
    syncMock.mockResolvedValue({ qboCustomerId: 'QB-1', alreadyExisted: true });
  });

  it.each(['matched', 'customer'])(
    'saves the trimmed status and starts a QuickBooks link for %s',
    async (status) => {
      await controller.updateClientStatus(
        request({ clientId, status: `  ${status} ` }),
        res as Response
      );

      expect(repo.updateClientStatusCanonical).toHaveBeenCalledWith(
        clientId,
        status
      );
      expect(syncMock).toHaveBeenCalledWith({
        clientId,
        firstName: 'Jane',
        lastName: 'Client',
        email: 'jane@example.com',
        existingQboCustomerId: 'QB-OLD',
      });
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    }
  );

  it.each(['lead', 'contacted', 'Matched', 'active'])(
    'does not start a QuickBooks link for %s',
    async (status) => {
      await controller.updateClientStatus(
        request({ clientId, status }),
        res as Response
      );

      expect(repo.updateClientStatusCanonical).toHaveBeenCalledWith(
        clientId,
        status
      );
      expect(syncMock).not.toHaveBeenCalled();
    }
  );

  it('passes empty strings for missing names and email', async () => {
    repo.updateClientStatusCanonical.mockResolvedValue({
      ...row,
      first_name: null,
      last_name: null,
      email: null,
      qbo_customer_id: null,
    } as never);

    await controller.updateClientStatus(
      request({ clientId, status: 'matched' }),
      res as Response
    );

    expect(syncMock).toHaveBeenCalledWith({
      clientId,
      firstName: '',
      lastName: '',
      email: '',
      existingQboCustomerId: null,
    });
  });

  it('still returns success when the QuickBooks link fails', async () => {
    syncMock.mockRejectedValue(new Error('QB down'));

    await controller.updateClientStatus(
      request({ clientId, status: 'matched' }),
      res as Response
    );
    await flushPromises();

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true })
    );
  });

  it.each([
    [{ status: 'matched' }, 'clientId is required'],
    [{ clientId: 42, status: 'matched' }, 'clientId is required'],
    [{ clientId }, 'status is required'],
    [{ clientId, status: '   ' }, 'status is required'],
    [{ clientId, status: 7 }, 'status is required'],
  ])('rejects %j with 400', async (body, message) => {
    await controller.updateClientStatus(request(body), res as Response);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.stringContaining(message),
        code: 'VALIDATION_ERROR',
      })
    );
    expect(repo.updateClientStatusCanonical).not.toHaveBeenCalled();
  });

  it('returns 404 when the client does not exist', async () => {
    repo.updateClientStatusCanonical.mockResolvedValue(null);

    await controller.updateClientStatus(
      request({ clientId, status: 'matched' }),
      res as Response
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(syncMock).not.toHaveBeenCalled();
  });

  it('returns 501 outside primary read mode', async () => {
    process.env.SPLIT_DB_READ_MODE = 'shadow';

    await controller.updateClientStatus(
      request({ clientId, status: 'matched' }),
      res as Response
    );

    expect(res.status).toHaveBeenCalledWith(501);
    expect(repo.updateClientStatusCanonical).not.toHaveBeenCalled();
  });
});

describe('CloudSqlClientRepository.updateClientStatusCanonical characterization', () => {
  const repository = new CloudSqlClientRepository();

  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .spyOn(repository, 'getClientById')
      .mockResolvedValue({ ...row } as never);
    queryMock.mockResolvedValue({ rows: [] });
  });

  it.each(['matched', 'customer'])(
    'stamps matched_at once when the status is %s',
    async (status) => {
      await repository.updateClientStatusCanonical(clientId, status);

      const [sql, params] = queryMock.mock.calls[0];
      expect(sql).toContain(
        'matched_at = COALESCE(matched_at, CURRENT_TIMESTAMP)'
      );
      expect(params).toEqual([status, clientId]);
    }
  );

  it.each(['lead', 'active', 'Matched'])(
    'only updates status for %s',
    async (status) => {
      await repository.updateClientStatusCanonical(clientId, status);

      const [sql, params] = queryMock.mock.calls[0];
      expect(sql).not.toContain('matched_at');
      expect(sql).toContain('SET status = $1');
      expect(params).toEqual([status, clientId]);
    }
  );
});
