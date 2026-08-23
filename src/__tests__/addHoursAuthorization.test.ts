import { Response } from 'express';

import { UserController } from '../controllers/userController';
import { logger } from '../common/utils/logger';
import { AuthRequest, ROLE } from '../types';
import { UserUseCase } from '../usecase/userUseCase';
import * as sensitiveAccess from '../utils/sensitiveAccess';

jest.mock('../utils/sensitiveAccess');

describe('POST /users/:id/addhours authorization (HIPAA-13E)', () => {
  let controller: UserController;
  let mockUserUseCase: jest.Mocked<Pick<UserUseCase, 'addNewHours'>>;
  let mockResponse: Partial<Response>;

  const doulaId = 'doula-authorized';
  const otherDoulaId = 'doula-other';
  const clientId = 'client-assigned';
  const unassignedClientId = 'client-unassigned';

  const validBody = {
    client_id: clientId,
    start_time: '2026-04-23T10:00:00.000Z',
    end_time: '2026-04-23T11:00:00.000Z',
    type: 'prenatal',
    note: '',
  };

  beforeEach(() => {
    mockUserUseCase = {
      addNewHours: jest.fn().mockResolvedValue({
        id: 'hour-1',
        doula_id: doulaId,
        client_id: clientId,
        type: 'prenatal',
      }),
    };

    controller = new UserController(mockUserUseCase as unknown as UserUseCase);

    mockResponse = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
    };

    (sensitiveAccess.canAccessSensitive as jest.Mock).mockResolvedValue({
      canAccess: true,
      assignedClientIds: [clientId],
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  function buildReq(
    user: AuthRequest['user'],
    params: { id: string },
    body: Record<string, unknown> = validBody
  ): AuthRequest {
    return {
      params,
      body,
      method: 'POST',
      path: `/users/${params.id}/addhours`,
      route: { path: '/:id/addhours' },
      user,
    } as unknown as AuthRequest;
  }

  it('allows assigned doula to log hours for assigned client', async () => {
    const req = buildReq(
      {
        id: doulaId,
        role: ROLE.DOULA,
        account_status: 'approved',
      } as any,
      { id: doulaId },
      { ...validBody, doula_id: doulaId }
    );

    await controller.addNewHours(req, mockResponse as Response);

    expect(sensitiveAccess.canAccessSensitive).toHaveBeenCalledWith(
      req.user,
      clientId
    );
    expect(mockUserUseCase.addNewHours).toHaveBeenCalledWith(
      doulaId,
      clientId,
      new Date(validBody.start_time),
      new Date(validBody.end_time),
      '',
      'prenatal'
    );
    expect(mockResponse.status).not.toHaveBeenCalledWith(403);
    expect(mockResponse.json).toHaveBeenCalled();
  });

  it('allows admin to log hours without assignment check', async () => {
    const req = buildReq(
      { id: 'admin-1', role: ROLE.ADMIN, account_status: 'approved' } as any,
      { id: doulaId },
      { ...validBody, doula_id: doulaId }
    );

    await controller.addNewHours(req, mockResponse as Response);

    expect(sensitiveAccess.canAccessSensitive).not.toHaveBeenCalled();
    expect(mockUserUseCase.addNewHours).toHaveBeenCalledWith(
      doulaId,
      clientId,
      expect.any(Date),
      expect.any(Date),
      '',
      'prenatal'
    );
    expect(mockResponse.json).toHaveBeenCalled();
  });

  it('rejects unassigned doula with 403', async () => {
    (sensitiveAccess.canAccessSensitive as jest.Mock).mockResolvedValue({
      canAccess: false,
      assignedClientIds: [],
    });

    const req = buildReq(
      { id: doulaId, role: ROLE.DOULA, account_status: 'approved' } as any,
      { id: doulaId },
      { ...validBody, doula_id: doulaId }
    );

    await controller.addNewHours(req, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Not authorized to log service hours',
      code: 'FORBIDDEN',
    });
    expect(mockUserUseCase.addNewHours).not.toHaveBeenCalled();
  });

  it('rejects client role with 403', async () => {
    const req = buildReq(
      { id: 'client-user', role: ROLE.CLIENT, account_status: 'approved' } as any,
      { id: 'client-user' },
      { ...validBody, doula_id: 'client-user' }
    );

    await controller.addNewHours(req, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockUserUseCase.addNewHours).not.toHaveBeenCalled();
    expect(sensitiveAccess.canAccessSensitive).not.toHaveBeenCalled();
  });

  it('rejects billing role with 403', async () => {
    const req = buildReq(
      { id: 'billing-user', role: ROLE.BILLING, account_status: 'approved' } as any,
      { id: 'billing-user' },
      { ...validBody, doula_id: 'billing-user' }
    );

    await controller.addNewHours(req, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockUserUseCase.addNewHours).not.toHaveBeenCalled();
  });

  it('rejects inactive (non-approved) doula with 403', async () => {
    const req = buildReq(
      { id: doulaId, role: ROLE.DOULA, account_status: 'pending' } as any,
      { id: doulaId },
      { ...validBody, doula_id: doulaId }
    );

    await controller.addNewHours(req, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockUserUseCase.addNewHours).not.toHaveBeenCalled();
    expect(sensitiveAccess.canAccessSensitive).not.toHaveBeenCalled();
  });

  it('rejects doula when path id is altered', async () => {
    const req = buildReq(
      { id: doulaId, role: ROLE.DOULA, account_status: 'approved' } as any,
      { id: otherDoulaId },
      { ...validBody, doula_id: doulaId }
    );

    await controller.addNewHours(req, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockUserUseCase.addNewHours).not.toHaveBeenCalled();
    expect(sensitiveAccess.canAccessSensitive).not.toHaveBeenCalled();
  });

  it('rejects doula when body doula_id is altered', async () => {
    const req = buildReq(
      { id: doulaId, role: ROLE.DOULA, account_status: 'approved' } as any,
      { id: doulaId },
      { ...validBody, doula_id: otherDoulaId }
    );

    await controller.addNewHours(req, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockUserUseCase.addNewHours).not.toHaveBeenCalled();
    expect(sensitiveAccess.canAccessSensitive).not.toHaveBeenCalled();
  });

  it('rejects doula logging hours for unassigned client id', async () => {
    (sensitiveAccess.canAccessSensitive as jest.Mock).mockResolvedValue({
      canAccess: false,
      assignedClientIds: [clientId],
    });

    const req = buildReq(
      { id: doulaId, role: ROLE.DOULA, account_status: 'approved' } as any,
      { id: doulaId },
      { ...validBody, client_id: unassignedClientId, doula_id: doulaId }
    );

    await controller.addNewHours(req, mockResponse as Response);

    expect(sensitiveAccess.canAccessSensitive).toHaveBeenCalledWith(
      req.user,
      unassignedClientId
    );
    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockUserUseCase.addNewHours).not.toHaveBeenCalled();
  });

  it('rejects missing authenticated user with 401', async () => {
    const req = buildReq(undefined, { id: doulaId });

    await controller.addNewHours(req, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockUserUseCase.addNewHours).not.toHaveBeenCalled();
  });

  it('logs authorization denials without PHI fields', async () => {
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => logger);
    const req = buildReq(
      { id: 'client-user', role: ROLE.CLIENT, account_status: 'approved' } as any,
      { id: 'client-user' },
      { ...validBody, doula_id: 'client-user' }
    );

    await controller.addNewHours(req, mockResponse as Response);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'backend-authz',
        event: 'authorization_denied',
        userId: 'client-user',
        role: 'client',
        status: 403,
        errorCode: 'FORBIDDEN',
      })
    );
    const logged = JSON.stringify(warnSpy.mock.calls[0][0]);
    expect(logged).not.toMatch(/client-assigned|prenatal|birth|address/i);
    warnSpy.mockRestore();
  });
});
