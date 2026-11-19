/**
 * Pins GET assigned-doulas and DELETE assign-doula before the use-case extract.
 * Synthetic ids only.
 */
import { Response } from 'express';

import { ClientController } from '../controllers/clientController';
import { AuthRequest, ROLE } from '../types';
import * as sensitiveAccess from '../utils/sensitiveAccess';

jest.mock('../utils/sensitiveAccess');

const clientId = '123e4567-e89b-12d3-a456-426614174001';
const otherClientId = '223e4567-e89b-12d3-a456-426614174099';
const doulaId = '123e4567-e89b-12d3-a456-426614174002';
const authUserId = 'client-auth-id';

function assignment(
  schedulingUrl: string | null = 'https://calendar.example.com/avery'
) {
  return {
    id: `${clientId}:${doulaId}`,
    doulaId,
    services: ['Labor Support'],
    assignedAt: new Date('2026-06-01T00:00:00.000Z'),
    role: 'primary',
    status: 'active',
    doula: {
      id: doulaId,
      firstname: 'Avery',
      lastname: 'Jones',
      email: 'avery@example.com',
      scheduling_url: schedulingUrl,
    },
  };
}

function buildHarness() {
  const controller = new ClientController({} as any, {} as any, {} as any);
  const getAssignedDoulas = jest.fn().mockResolvedValue([assignment()]);
  const getClientIdByAuthUserId = jest.fn().mockResolvedValue(clientId);
  const unassignDoula = jest.fn().mockResolvedValue(true);
  const getAvailabilityStatusForDoulas = jest.fn().mockResolvedValue(new Map());
  const isClientInContractStage = jest.fn().mockResolvedValue(false);

  (controller as any).cloudSqlAssignmentService = {
    getAssignedDoulas,
    getClientIdByAuthUserId,
    unassignDoula,
  };
  (controller as any).doulaAvailabilityService = {
    getAvailabilityStatusForDoulas,
    isClientInContractStage,
  };

  (sensitiveAccess.canAccessSensitive as jest.Mock).mockResolvedValue({
    canAccess: true,
    assignedClientIds: [clientId],
  });

  return {
    controller,
    getAssignedDoulas,
    getClientIdByAuthUserId,
    unassignDoula,
    getAvailabilityStatusForDoulas,
    isClientInContractStage,
  };
}

function buildResponse() {
  return {
    json: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
    headersSent: false,
  } as unknown as Response;
}

function request(partial: Partial<AuthRequest>): AuthRequest {
  return partial as AuthRequest;
}

describe('assigned doulas characterization', () => {
  it('returns 400 for a missing client id and does not list', async () => {
    const harness = buildHarness();
    const res = buildResponse();

    await harness.controller.getAssignedDoulas(
      request({
        params: {},
        user: { id: 'admin-id', role: ROLE.ADMIN } as any,
      }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Missing clientId' });
    expect(harness.getAssignedDoulas).not.toHaveBeenCalled();
  });

  it('returns 404 when a client has no profile', async () => {
    const harness = buildHarness();
    harness.getClientIdByAuthUserId.mockResolvedValue(null);
    const res = buildResponse();

    await harness.controller.getAssignedDoulas(
      request({
        params: { id: clientId },
        user: { id: authUserId, role: ROLE.CLIENT } as any,
      }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Client profile not found',
    });
    expect(harness.getAssignedDoulas).not.toHaveBeenCalled();
  });

  it('returns 403 when a client asks for another client', async () => {
    const harness = buildHarness();
    const res = buildResponse();

    await harness.controller.getAssignedDoulas(
      request({
        params: { id: otherClientId },
        user: { id: authUserId, role: ROLE.CLIENT } as any,
      }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Forbidden: cannot access other client assignments',
    });
    expect(harness.getAssignedDoulas).not.toHaveBeenCalled();
  });

  it('rewrites a client auth-user id to the client row id', async () => {
    const harness = buildHarness();
    const res = buildResponse();

    await harness.controller.getAssignedDoulas(
      request({
        params: { id: authUserId },
        user: { id: authUserId, role: ROLE.CLIENT } as any,
      }),
      res
    );

    expect(harness.getAssignedDoulas).toHaveBeenCalledWith(clientId);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true })
    );
  });

  it('shows the scheduling link to an admin and skips the contract-stage check', async () => {
    const harness = buildHarness();
    const res = buildResponse();

    await harness.controller.getAssignedDoulas(
      request({
        params: { id: clientId },
        user: { id: 'admin-id', role: ROLE.ADMIN } as any,
      }),
      res
    );

    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.doulas[0].doula.scheduling_url).toBe(
      'https://calendar.example.com/avery'
    );
    expect(harness.isClientInContractStage).not.toHaveBeenCalled();
  });

  it('hides the scheduling link from an assigned doula', async () => {
    const harness = buildHarness();
    const res = buildResponse();

    await harness.controller.getAssignedDoulas(
      request({
        params: { id: clientId },
        user: { id: 'doula-assigned', role: ROLE.DOULA } as any,
      }),
      res
    );

    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.doulas[0].doula.scheduling_url).toBeNull();
    expect(harness.isClientInContractStage).not.toHaveBeenCalled();
  });

  it('returns 404 for an unassigned doula without listing', async () => {
    const harness = buildHarness();
    (sensitiveAccess.canAccessSensitive as jest.Mock).mockResolvedValue({
      canAccess: false,
      assignedClientIds: [],
    });
    const res = buildResponse();

    await harness.controller.getAssignedDoulas(
      request({
        params: { id: clientId },
        user: { id: 'doula-unassigned', role: ROLE.DOULA } as any,
      }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Client not found',
      code: 'NOT_FOUND',
    });
    expect(harness.getAssignedDoulas).not.toHaveBeenCalled();
  });

  it('defaults a missing availability row to available', async () => {
    const harness = buildHarness();
    const res = buildResponse();

    await harness.controller.getAssignedDoulas(
      request({
        params: { id: clientId },
        user: { id: 'admin-id', role: ROLE.ADMIN } as any,
      }),
      res
    );

    expect(
      (res.json as jest.Mock).mock.calls[0][0].doulas[0].availabilityStatus
    ).toEqual({
      status: 'available',
      reason: null,
      startAt: null,
      endAt: null,
    });
  });

  it('returns an empty list when the assignments table is missing', async () => {
    const harness = buildHarness();
    harness.getAssignedDoulas.mockRejectedValue(
      new Error('relation "doula_assignments" does not exist')
    );
    const res = buildResponse();

    await harness.controller.getAssignedDoulas(
      request({
        params: { id: clientId },
        user: { id: 'admin-id', role: ROLE.ADMIN } as any,
      }),
      res
    );

    expect(res.json).toHaveBeenCalledWith({ success: true, doulas: [] });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 400 when unassign is missing an id', async () => {
    const harness = buildHarness();
    const res = buildResponse();

    await harness.controller.unassignDoula(
      request({
        params: { id: clientId },
        user: { id: 'admin-id', role: ROLE.ADMIN } as any,
      }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Missing clientId or doulaId',
    });
    expect(harness.unassignDoula).not.toHaveBeenCalled();
  });

  it('returns 404 when the assignment is not active', async () => {
    const harness = buildHarness();
    harness.unassignDoula.mockResolvedValue(false);
    const res = buildResponse();

    await harness.controller.unassignDoula(
      request({
        params: { id: clientId, doulaId },
        user: { id: 'admin-id', role: ROLE.ADMIN } as any,
      }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Assignment not found' });
  });

  it('returns the success message when unassign removes a row', async () => {
    const harness = buildHarness();
    const res = buildResponse();

    await harness.controller.unassignDoula(
      request({
        params: { id: clientId, doulaId },
        user: { id: 'admin-id', role: ROLE.ADMIN } as any,
      }),
      res
    );

    expect(harness.unassignDoula).toHaveBeenCalledWith(clientId, doulaId);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Doula unassigned successfully',
    });
  });

  it('returns a safe 500 when unassign hits a missing table', async () => {
    const harness = buildHarness();
    harness.unassignDoula.mockRejectedValue(
      new Error('relation "doula_assignments" does not exist')
    );
    const res = buildResponse();

    await harness.controller.unassignDoula(
      request({
        params: { id: clientId, doulaId },
        user: { id: 'admin-id', role: ROLE.ADMIN } as any,
      }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal Server Error' });
  });
});
