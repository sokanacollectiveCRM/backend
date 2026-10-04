import { Response } from 'express';

import { ASSIGNMENT_SERVICE_CATALOG } from '../constants/assignmentServices';
import { AdminController } from '../controllers/adminController';
import { ClientController } from '../controllers/clientController';
import { ConflictError } from '../domains/errors';
import { AuthRequest, ROLE } from '../types';

const clientId = '123e4567-e89b-12d3-a456-426614174001';
const doulaId = '123e4567-e89b-12d3-a456-426614174002';
const catalog = ASSIGNMENT_SERVICE_CATALOG.join(', ');

function buildResponse() {
  return {
    json: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
    headersSent: false,
  } as unknown as Response & {
    json: jest.Mock;
    status: jest.Mock;
  };
}

function clientRequest(
  body: Record<string, unknown>,
  params: Record<string, string> = { id: clientId }
): AuthRequest {
  return {
    params,
    body,
    user: { id: 'admin-user-id', role: ROLE.ADMIN },
  } as unknown as AuthRequest;
}

describe('client assign-doula decisions', () => {
  function controllerWith(overrides?: {
    assignmentExists?: jest.Mock;
    assignDoula?: jest.Mock;
    getCurrentAvailabilityStatus?: jest.Mock;
    assertDoulaAvailableForPeriod?: jest.Mock;
  }) {
    const controller = new ClientController({} as any, {} as any, {} as any);
    const assignmentExists =
      overrides?.assignmentExists ?? jest.fn().mockResolvedValue(false);
    const assignDoula = overrides?.assignDoula ?? jest.fn();
    const getCurrentAvailabilityStatus =
      overrides?.getCurrentAvailabilityStatus ??
      jest.fn().mockResolvedValue({
        status: 'available',
        reason: null,
        startAt: null,
        endAt: null,
      });
    const assertDoulaAvailableForPeriod =
      overrides?.assertDoulaAvailableForPeriod ??
      jest.fn().mockResolvedValue(undefined);
    (controller as any).cloudSqlAssignmentService = {
      assignmentExists,
      assignDoula,
    };
    (controller as any).doulaAvailabilityService = {
      getCurrentAvailabilityStatus,
      assertDoulaAvailableForPeriod,
    };
    return {
      controller,
      assignmentExists,
      assignDoula,
      getCurrentAvailabilityStatus,
      assertDoulaAvailableForPeriod,
    };
  }

  it('rejects a missing doula id before any lookup', async () => {
    const { controller, assignmentExists } = controllerWith();
    const res = buildResponse();

    await controller.assignDoula(clientRequest({}), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Missing clientId or doulaId',
    });
    expect(assignmentExists).not.toHaveBeenCalled();
  });

  it('rejects services before role, and lists the catalog', async () => {
    const { controller, assignmentExists } = controllerWith();
    const res = buildResponse();

    await controller.assignDoula(
      clientRequest({ doulaId, role: 'neither', services: ['Yoga'] }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: `services is required and must contain one or more valid values: ${catalog}`,
    });
    expect(assignmentExists).not.toHaveBeenCalled();
  });

  it('rejects an unknown role after services pass', async () => {
    const { controller } = controllerWith();
    const res = buildResponse();

    await controller.assignDoula(
      clientRequest({ doulaId, role: 'neither', services: ['Labor Support'] }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid role. Allowed values are 'primary' or 'backup'",
    });
  });

  it('returns 409 when the doula is already assigned and skips availability', async () => {
    const { controller, getCurrentAvailabilityStatus, assignDoula } =
      controllerWith({
        assignmentExists: jest.fn().mockResolvedValue(true),
      });
    const res = buildResponse();

    await controller.assignDoula(
      clientRequest({ doulaId, services: ['Labor Support'] }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: 'This doula is already assigned to this client',
    });
    expect(getCurrentAvailabilityStatus).not.toHaveBeenCalled();
    expect(assignDoula).not.toHaveBeenCalled();
  });

  it('requires the assignment window start and end together', async () => {
    const { controller, assertDoulaAvailableForPeriod, assignDoula } =
      controllerWith();
    const res = buildResponse();

    await controller.assignDoula(
      clientRequest({
        doulaId,
        services: ['Labor Support'],
        assignment_start: '2026-11-01T00:00:00.000Z',
      }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'assignmentStart and assignmentEnd must be provided together',
    });
    expect(assertDoulaAvailableForPeriod).not.toHaveBeenCalled();
    expect(assignDoula).not.toHaveBeenCalled();
  });

  it('returns the period conflict from availability and does not write', async () => {
    const { controller, assignDoula } = controllerWith({
      assertDoulaAvailableForPeriod: jest
        .fn()
        .mockRejectedValue(
          new ConflictError(
            'Doula is unavailable for the requested time. Unavailable from a to b.'
          )
        ),
    });
    const res = buildResponse();

    await controller.assignDoula(
      clientRequest({
        doulaId,
        services: ['Labor Support'],
        requestedStart: '2026-11-01T00:00:00.000Z',
        requested_end: '2026-11-02T00:00:00.000Z',
      }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error:
        'Doula is unavailable for the requested time. Unavailable from a to b.',
    });
    expect(assignDoula).not.toHaveBeenCalled();
  });

  it('writes a trimmed role and de-duplicated services', async () => {
    const saved = {
      id: `${clientId}:${doulaId}`,
      clientId,
      doulaId,
      services: ['Labor Support'],
      assignedAt: new Date('2026-10-04T00:00:00.000Z'),
      role: 'primary',
      status: 'active',
    };
    const { controller, assignDoula, assertDoulaAvailableForPeriod } =
      controllerWith({
        assignDoula: jest.fn().mockResolvedValue(saved),
      });
    const res = buildResponse();

    await controller.assignDoula(
      clientRequest({
        doulaId,
        role: ' Primary ',
        services: ['Labor Support', 'Labor Support', ' labor support '],
      }),
      res
    );

    expect(assertDoulaAvailableForPeriod).not.toHaveBeenCalled();
    expect(assignDoula).toHaveBeenCalledWith(
      clientId,
      doulaId,
      'admin-user-id',
      undefined,
      'primary',
      ['Labor Support', 'labor support']
    );
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      assignment: {
        id: saved.id,
        doulaId,
        clientId,
        services: saved.services,
        assignedAt: saved.assignedAt,
        role: 'primary',
        status: 'active',
      },
    });
  });
});

describe('admin match decisions', () => {
  function controllerWith() {
    const controller = new AdminController({} as any, {} as any);
    const findById = jest.fn();
    const getDoulaById = jest.fn();
    const assignmentExists = jest.fn().mockResolvedValue(false);
    const assignDoula = jest.fn();
    const sendDoulaMatchNotification = jest.fn().mockResolvedValue(undefined);
    const sendClientMatchNotification = jest.fn().mockResolvedValue(undefined);
    (controller as any).clientRepository = { findById };
    (controller as any).cloudSqlAssignmentService = {
      getDoulaById,
      assignmentExists,
      assignDoula,
    };
    (controller as any).emailController = {
      sendDoulaMatchNotification,
      sendClientMatchNotification,
    };
    return {
      controller,
      findById,
      getDoulaById,
      assignmentExists,
      assignDoula,
      sendDoulaMatchNotification,
      sendClientMatchNotification,
    };
  }

  function adminRequest(body: Record<string, unknown>): AuthRequest {
    return {
      body,
      user: { id: 'admin-user-id', role: ROLE.ADMIN },
    } as unknown as AuthRequest;
  }

  it('rejects a missing doula id with the admin envelope', async () => {
    const { controller, findById } = controllerWith();
    const res = buildResponse();

    await controller.matchDoulaWithClient(
      adminRequest({ clientId, services: ['Labor Support'] }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Missing required fields: clientId and doulaId are required',
    });
    expect(findById).not.toHaveBeenCalled();
  });

  it('checks role before services', async () => {
    const { controller, findById } = controllerWith();
    const res = buildResponse();

    await controller.matchDoulaWithClient(
      adminRequest({ clientId, doulaId, role: 'neither', services: [] }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Invalid role. Allowed values are 'primary' or 'backup'",
    });
    expect(findById).not.toHaveBeenCalled();
  });

  it('uses the admin service-list message', async () => {
    const { controller } = controllerWith();
    const res = buildResponse();

    await controller.matchDoulaWithClient(
      adminRequest({ clientId, doulaId, services: ['Yoga'] }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: `services is required and must include one or more values from: ${catalog}`,
    });
  });

  it('requires the client to be in the matching phase', async () => {
    const { controller, findById, getDoulaById } = controllerWith();
    findById.mockResolvedValue({
      id: clientId,
      status: 'lead',
      user: {
        firstname: 'Ada',
        lastname: 'Lovelace',
        email: 'ada@example.com',
      },
    });
    const res = buildResponse();

    await controller.matchDoulaWithClient(
      adminRequest({ clientId, doulaId, services: ['Labor Support'] }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error:
        "Client is not in matching phase. Current status: lead. Only clients with status 'matching' can be assigned to doulas.",
    });
    expect(getDoulaById).not.toHaveBeenCalled();
  });

  it('returns 400 when the doula is already assigned', async () => {
    const {
      controller,
      findById,
      getDoulaById,
      assignmentExists,
      assignDoula,
    } = controllerWith();
    findById.mockResolvedValue({
      id: clientId,
      status: 'matching',
      user: {
        firstname: 'Ada',
        lastname: 'Lovelace',
        email: 'ada@example.com',
      },
    });
    getDoulaById.mockResolvedValue({
      id: doulaId,
      fullName: 'Pat Doula',
      email: 'pat@example.com',
    });
    assignmentExists.mockResolvedValue(true);
    const res = buildResponse();

    await controller.matchDoulaWithClient(
      adminRequest({ clientId, doulaId, services: ['Labor Support'] }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'This doula is already assigned to this client',
    });
    expect(assignDoula).not.toHaveBeenCalled();
  });

  it('writes the match and still succeeds when notification email fails', async () => {
    const saved = {
      id: `${clientId}:${doulaId}`,
      clientId,
      doulaId,
      services: ['Labor Support'],
      assignedAt: new Date('2026-10-04T00:00:00.000Z'),
      assignedBy: 'admin-user-id',
      notes: 'weekends',
      role: 'backup',
      status: 'active' as const,
    };
    const {
      controller,
      findById,
      getDoulaById,
      assignDoula,
      sendDoulaMatchNotification,
    } = controllerWith();
    findById.mockResolvedValue({
      id: clientId,
      status: 'matching',
      clientNumber: 'C-100',
      user: {
        firstname: 'Ada',
        lastname: 'Lovelace',
        email: 'ada@example.com',
      },
    });
    getDoulaById.mockResolvedValue({
      id: doulaId,
      fullName: 'Pat Doula',
      email: 'pat@example.com',
    });
    assignDoula.mockResolvedValue(saved);
    sendDoulaMatchNotification.mockRejectedValue(new Error('smtp down'));
    const res = buildResponse();

    await controller.matchDoulaWithClient(
      adminRequest({
        clientId,
        doulaId,
        role: 'backup',
        notes: 'weekends',
        services: ['Labor Support'],
      }),
      res
    );

    expect(assignDoula).toHaveBeenCalledWith(
      clientId,
      doulaId,
      'admin-user-id',
      'weekends',
      'backup',
      ['Labor Support']
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Doula successfully matched with client',
      data: {
        assignment: {
          id: saved.id,
          clientId,
          doulaId,
          services: saved.services,
          assignedAt: saved.assignedAt,
          assignedBy: 'admin-user-id',
          notes: 'weekends',
          role: 'backup',
          status: 'active',
        },
        client: {
          id: clientId,
          name: 'Ada Lovelace',
          status: 'matching',
        },
        doula: {
          id: doulaId,
          name: 'Pat Doula',
          email: 'pat@example.com',
        },
      },
    });
  });
});
