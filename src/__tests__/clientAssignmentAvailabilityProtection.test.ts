import { Response } from 'express';
import { ClientController } from '../controllers/clientController';
import { AuthRequest, ROLE } from '../types';

describe('Client assignment availability protection', () => {
  const clientId = '123e4567-e89b-12d3-a456-426614174001';
  const doulaId = '123e4567-e89b-12d3-a456-426614174002';

  function buildResponse() {
    return {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      headersSent: false,
    } as unknown as Response;
  }

  it('rejects assigning a doula who is currently unavailable even without an assignment window', async () => {
    const controller = new ClientController({} as any, {} as any, {} as any);
    (controller as any).cloudSqlAssignmentService = {
      assignmentExists: jest.fn().mockResolvedValue(false),
      assignDoula: jest.fn(),
    };
    (controller as any).doulaAvailabilityService = {
      getCurrentAvailabilityStatus: jest.fn().mockResolvedValue({
        status: 'unavailable',
        reason: 'vacation',
        startAt: '2026-06-20T00:00:00.000Z',
        endAt: '2026-06-25T23:59:59.999Z',
      }),
      assertDoulaAvailableForPeriod: jest.fn(),
    };

    const req = {
      params: { id: clientId },
      body: {
        doulaId,
        services: ['Labor Support'],
      },
      user: { id: 'admin-user-id', role: ROLE.ADMIN } as any,
    } as unknown as AuthRequest;
    const res = buildResponse();

    await controller.assignDoula(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error:
        'Doula is currently unavailable (vacation). Unavailable from 2026-06-20T00:00:00.000Z to 2026-06-25T23:59:59.999Z.',
    });
    expect((controller as any).cloudSqlAssignmentService.assignDoula).not.toHaveBeenCalled();
  });
});
