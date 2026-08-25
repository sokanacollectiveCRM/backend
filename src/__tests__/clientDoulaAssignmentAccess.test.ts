/**
 * HIPAA-13B / INV-03 / INV-13 — Doula assignment gates on client/family reads.
 *
 * Ensures doulas cannot read (or write notes to) client records they are not
 * assigned to, and cannot infer record existence from response shape.
 */
import { Response } from 'express';

import { ClientController } from '../controllers/clientController';
import { Activity } from '../entities/Activity';
import { ClientRepository } from '../repositories/interface/clientRepository';
import { SupabaseAssignmentRepository } from '../repositories/supabaseAssignmentRepository';
import { AuthRequest, ROLE } from '../types';
import { ClientUseCase } from '../usecase/clientUseCase';
import * as sensitiveAccess from '../utils/sensitiveAccess';

jest.mock('../utils/sensitiveAccess');

describe('Client doula assignment access (HIPAA-13B)', () => {
  const clientId = '123e4567-e89b-12d3-a456-426614174000';
  const otherClientId = '223e4567-e89b-12d3-a456-426614174099';
  const assignedDoulaId = 'doula-assigned';
  const unassignedDoulaId = 'doula-unassigned';
  const inactiveDoulaId = 'doula-inactive';

  let clientController: ClientController;
  let mockClientUseCase: jest.Mocked<ClientUseCase>;
  let mockClientRepository: jest.Mocked<ClientRepository>;
  let mockResponse: Partial<Response>;

  const clientRow = {
    id: clientId,
    first_name: 'Jane',
    last_name: 'Client',
    email: 'jane@example.com',
    phone_number: '555-0100',
    address_line1: '1 Main St',
    bio: null,
    city: 'Chicago',
    state: 'IL',
    zip_code: '60601',
    country: 'US',
    status: 'matched',
    service_needed: 'Birth Support',
    portal_status: 'active',
    invited_at: null,
    last_invite_sent_at: null,
    invite_sent_count: null,
    requested_at: null,
    updated_at: '2026-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    process.env.SPLIT_DB_READ_MODE = 'primary';

    mockClientUseCase = {
      getClientActivities: jest.fn().mockResolvedValue([]),
      createActivity: jest
        .fn()
        .mockResolvedValue(
          new Activity(
            'activity-1',
            clientId,
            'note',
            'hello',
            {},
            new Date(),
            assignedDoulaId
          )
        ),
    } as unknown as jest.Mocked<ClientUseCase>;

    mockClientRepository = {
      getClientById: jest
        .fn()
        .mockImplementation(async (id: string) =>
          id === clientId ? clientRow : null
        ),
      findClientDetailedById: jest.fn().mockResolvedValue({
        user: {
          firstname: 'Jane',
          lastname: 'Client',
          email: 'jane@example.com',
        },
      }),
      updateClientStatusCanonical: jest
        .fn()
        .mockResolvedValue({ ...clientRow, status: 'lead' }),
    } as unknown as jest.Mocked<ClientRepository>;

    clientController = new ClientController(
      mockClientUseCase,
      {} as jest.Mocked<SupabaseAssignmentRepository>,
      mockClientRepository
    );

    mockResponse = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      headersSent: false,
    };

    (sensitiveAccess.canAccessSensitive as jest.Mock).mockImplementation(
      async (_user: { id: string }, targetClientId: string) => {
        const assigned =
          _user.id === assignedDoulaId && targetClientId === clientId;
        return {
          canAccess: assigned,
          assignedClientIds: assigned ? [clientId] : [],
        };
      }
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /clients/:id (getClientById)', () => {
    it('allows assigned doula to read assigned client', async () => {
      const req = {
        params: { id: clientId },
        user: { id: assignedDoulaId, role: ROLE.DOULA } as any,
      } as unknown as AuthRequest;

      await clientController.getClientById(req, mockResponse as Response);

      expect(mockClientRepository.getClientById).toHaveBeenCalledWith(clientId);
      expect(mockResponse.status).not.toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });

    it('returns 404 for unassigned doula without leaking operational fields', async () => {
      const req = {
        params: { id: clientId },
        user: { id: unassignedDoulaId, role: ROLE.DOULA } as any,
      } as unknown as AuthRequest;

      await clientController.getClientById(req, mockResponse as Response);

      expect(mockClientRepository.getClientById).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Client not found',
        code: 'NOT_FOUND',
      });
    });

    it('returns 404 for inactive assignment (no active assign)', async () => {
      const req = {
        params: { id: clientId },
        user: {
          id: inactiveDoulaId,
          role: ROLE.DOULA,
          account_status: 'inactive',
        } as any,
      } as unknown as AuthRequest;

      await clientController.getClientById(req, mockResponse as Response);

      expect(mockClientRepository.getClientById).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('returns 403 for client role accessing another client id', async () => {
      const req = {
        params: { id: otherClientId },
        user: { id: 'client-auth-id', role: ROLE.CLIENT } as any,
      } as unknown as AuthRequest;

      (
        clientController as unknown as {
          cloudSqlAssignmentService: {
            getClientIdByAuthUserId: jest.Mock;
          };
        }
      ).cloudSqlAssignmentService = {
        getClientIdByAuthUserId: jest.fn().mockResolvedValue(clientId),
      };

      await clientController.getClientById(req, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockClientRepository.getClientById).not.toHaveBeenCalled();
    });

    it('returns 403 for billing role without client lookup', async () => {
      const req = {
        params: { id: clientId },
        user: { id: 'billing-user', role: ROLE.BILLING } as any,
      } as unknown as AuthRequest;

      await clientController.getClientById(req, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockClientRepository.getClientById).not.toHaveBeenCalled();
    });

    it('returns 404 for altered client id (unassigned)', async () => {
      const req = {
        params: { id: otherClientId },
        user: { id: unassignedDoulaId, role: ROLE.DOULA } as any,
      } as unknown as AuthRequest;

      await clientController.getClientById(req, mockResponse as Response);

      expect(mockClientRepository.getClientById).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('allows admin to read any existing client', async () => {
      const req = {
        params: { id: clientId },
        user: { id: 'admin-id', role: ROLE.ADMIN } as any,
      } as unknown as AuthRequest;

      await clientController.getClientById(req, mockResponse as Response);

      expect(mockClientRepository.getClientById).toHaveBeenCalledWith(clientId);
      expect(mockResponse.status).not.toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });

    it('returns 404 for admin when client does not exist', async () => {
      mockClientRepository.getClientById = jest.fn().mockResolvedValue(null);

      const req = {
        params: { id: otherClientId },
        user: { id: 'admin-id', role: ROLE.ADMIN } as any,
      } as unknown as AuthRequest;

      await clientController.getClientById(req, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('returns 403 for unauthenticated getClientById', async () => {
      const req = {
        params: { id: clientId },
        user: undefined,
      } as unknown as AuthRequest;

      await clientController.getClientById(req, mockResponse as Response);

      expect(mockClientRepository.getClientById).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });
  });

  describe('GET /clients/:id/activities (getClientActivities)', () => {
    it('allows assigned doula', async () => {
      const req = {
        params: { id: clientId },
        user: { id: assignedDoulaId, role: ROLE.DOULA } as any,
      } as unknown as AuthRequest;

      await clientController.getClientActivities(req, mockResponse as Response);

      expect(mockClientUseCase.getClientActivities).toHaveBeenCalledWith(
        clientId
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });

    it('returns 404 for unassigned doula without client lookup', async () => {
      const req = {
        params: { id: clientId },
        user: { id: unassignedDoulaId, role: ROLE.DOULA } as any,
      } as unknown as AuthRequest;

      await clientController.getClientActivities(req, mockResponse as Response);

      expect(mockClientRepository.getClientById).not.toHaveBeenCalled();
      expect(mockClientUseCase.getClientActivities).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('returns 403 for billing role', async () => {
      const req = {
        params: { id: clientId },
        user: { id: 'billing-user', role: ROLE.BILLING } as any,
      } as unknown as AuthRequest;

      await clientController.getClientActivities(req, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });
  });

  describe('POST /clients/:id/activity (createActivity)', () => {
    const validBody = { activity_type: 'note', content: 'Test note' };

    it('allows assigned doula to create activity', async () => {
      const req = {
        params: { id: clientId },
        body: validBody,
        user: {
          id: assignedDoulaId,
          role: ROLE.DOULA,
          email: 'd@example.com',
        } as any,
      } as unknown as AuthRequest;

      await clientController.createActivity(req, mockResponse as Response);

      expect(mockClientUseCase.createActivity).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });

    it('returns 403 for unassigned doula without client lookup', async () => {
      const req = {
        params: { id: clientId },
        body: validBody,
        user: { id: unassignedDoulaId, role: ROLE.DOULA } as any,
      } as unknown as AuthRequest;

      await clientController.createActivity(req, mockResponse as Response);

      expect(mockClientRepository.getClientById).not.toHaveBeenCalled();
      expect(mockClientUseCase.createActivity).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });

    it('returns 403 for billing role', async () => {
      const req = {
        params: { id: clientId },
        body: validBody,
        user: { id: 'billing-user', role: ROLE.BILLING } as any,
      } as unknown as AuthRequest;

      await clientController.createActivity(req, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockClientUseCase.createActivity).not.toHaveBeenCalled();
    });
  });

  describe('GET /clients/:id/assigned-doulas (getAssignedDoulas)', () => {
    it('returns 404 for unassigned doula without assignment lookup', async () => {
      const req = {
        params: { id: clientId },
        user: { id: unassignedDoulaId, role: ROLE.DOULA } as any,
      } as unknown as AuthRequest;

      await clientController.getAssignedDoulas(req, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('allows admin to list assigned doulas', async () => {
      (
        clientController as unknown as {
          cloudSqlAssignmentService: { getAssignedDoulas: jest.Mock };
        }
      ).cloudSqlAssignmentService = {
        getAssignedDoulas: jest.fn().mockResolvedValue([]),
      };
      (
        clientController as unknown as {
          doulaAvailabilityService: {
            getAvailabilityStatusForDoulas: jest.Mock;
          };
        }
      ).doulaAvailabilityService = {
        getAvailabilityStatusForDoulas: jest.fn().mockResolvedValue(new Map()),
      };

      const req = {
        params: { id: clientId },
        user: { id: 'admin-id', role: ROLE.ADMIN } as any,
      } as unknown as AuthRequest;

      await clientController.getAssignedDoulas(req, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, doulas: [] })
      );
    });
  });

  describe('PUT /clients/status (updateClientStatus)', () => {
    it('returns 403 for unassigned doula without status write', async () => {
      const req = {
        body: { clientId, status: 'lead' },
        user: { id: unassignedDoulaId, role: ROLE.DOULA } as any,
      } as unknown as AuthRequest;

      await clientController.updateClientStatus(req, mockResponse as Response);

      expect(
        mockClientRepository.updateClientStatusCanonical
      ).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });

    it('allows admin to update status', async () => {
      const req = {
        body: { clientId, status: 'lead' },
        user: { id: 'admin-id', role: ROLE.ADMIN } as any,
      } as unknown as AuthRequest;

      await clientController.updateClientStatus(req, mockResponse as Response);

      expect(
        mockClientRepository.updateClientStatusCanonical
      ).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalledWith(403);
    });
  });
});
