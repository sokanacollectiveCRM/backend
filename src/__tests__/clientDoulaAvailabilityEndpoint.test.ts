import { Response } from 'express';
import { ClientController } from '../controllers/clientController';
import { ConflictError } from '../domains/errors';
import { AuthRequest, ROLE } from '../types';

describe('Client doula availability and booking protections', () => {
  const clientId = '123e4567-e89b-12d3-a456-426614174001';
  const doulaId = '123e4567-e89b-12d3-a456-426614174002';

  function buildController() {
    const controller = new ClientController({} as any, {} as any, {} as any);

    (controller as any).cloudSqlAssignmentService = {
      getClientIdByAuthUserId: jest.fn().mockResolvedValue(clientId),
      getAssignedDoulas: jest.fn().mockResolvedValue([
        {
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
            scheduling_url: 'https://calendar.example.com/avery',
          },
        },
      ]),
      assignmentExists: jest.fn().mockResolvedValue(true),
    };

    (controller as any).doulaAvailabilityService = {
      getAvailabilityStatusForDoulas: jest.fn().mockResolvedValue(new Map([
        [
          doulaId,
          {
            status: 'unavailable',
            reason: 'vacation',
            startAt: '2026-06-20T10:00:00.000Z',
            endAt: '2026-06-20T12:00:00.000Z',
          },
        ],
      ])),
      isClientInContractStage: jest.fn(),
      createBookingRequest: jest.fn(),
    };

    return controller;
  }

  function buildResponse() {
    return {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      headersSent: false,
    } as unknown as Response;
  }

  it('hides scheduling links from clients before contract stage but still returns availability status', async () => {
    const controller = buildController();
    (controller as any).doulaAvailabilityService.isClientInContractStage.mockResolvedValue(false);
    const res = buildResponse();
    const req = {
      params: { id: clientId },
      user: { id: 'client-auth-id', role: ROLE.CLIENT } as any,
    } as unknown as AuthRequest;

    await controller.getAssignedDoulas(req, res);

    expect((res.json as jest.Mock).mock.calls[0][0].doulas[0].doula.scheduling_url).toBeNull();
    expect((res.json as jest.Mock).mock.calls[0][0].doulas[0].availabilityStatus.status).toBe('unavailable');
  });

  it('returns scheduling links to clients in contract stage', async () => {
    const controller = buildController();
    (controller as any).doulaAvailabilityService.isClientInContractStage.mockResolvedValue(true);
    const res = buildResponse();
    const req = {
      params: { id: clientId },
      user: { id: 'client-auth-id', role: ROLE.CLIENT } as any,
    } as unknown as AuthRequest;

    await controller.getAssignedDoulas(req, res);

    expect((res.json as jest.Mock).mock.calls[0][0].doulas[0].doula.scheduling_url).toBe(
      'https://calendar.example.com/avery'
    );
  });

  it('rejects booking requests that overlap unavailable periods', async () => {
    const controller = buildController();
    (controller as any).doulaAvailabilityService.isClientInContractStage.mockResolvedValue(true);
    (controller as any).doulaAvailabilityService.createBookingRequest.mockRejectedValue(
      new ConflictError('Doula is unavailable for the requested time.')
    );
    const res = buildResponse();
    const req = {
      params: { id: clientId, doulaId },
      body: {
        startAt: '2026-06-20T11:00:00.000Z',
        endAt: '2026-06-20T11:30:00.000Z',
      },
      user: { id: 'client-auth-id', role: ROLE.CLIENT } as any,
    } as unknown as AuthRequest;

    await controller.createDoulaBookingRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Doula is unavailable for the requested time.',
    });
  });
});
