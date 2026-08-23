import { Response } from 'express';

import { ClientController } from '../controllers/clientController';
import { ClientRepository } from '../repositories/interface/clientRepository';
import { SupabaseAssignmentRepository } from '../repositories/supabaseAssignmentRepository';
import { AuthRequest, ROLE } from '../types';
import { ClientUseCase } from '../usecase/clientUseCase';
import * as sensitiveAccess from '../utils/sensitiveAccess';

jest.mock('../utils/sensitiveAccess');
jest.mock('../repositories/supabaseAssignmentRepository');
jest.mock('../usecase/clientUseCase');

describe('PUT /clients/:id/birth-outcomes', () => {
  let clientController: ClientController;
  let mockResponse: Partial<Response>;
  let mockClientRepository: jest.Mocked<ClientRepository>;

  const clientId = '123e4567-e89b-12d3-a456-426614174000';

  beforeEach(() => {
    process.env.SPLIT_DB_READ_MODE = 'primary';

    mockClientRepository = {
      getClientById: jest.fn().mockResolvedValue({ id: clientId } as any),
      updateClientOperational: jest
        .fn()
        .mockResolvedValue({ id: clientId } as any),
      findClientDetailedById: jest.fn().mockResolvedValue({
        user: {
          birth_outcomes_induction: true,
          birth_outcomes_delivery_type: 'Emergency Cesarean',
          birth_outcomes_medications_used: ['Pitocin'],
        },
      } as any),
    } as unknown as jest.Mocked<ClientRepository>;

    clientController = new ClientController(
      {} as jest.Mocked<ClientUseCase>,
      {} as jest.Mocked<SupabaseAssignmentRepository>,
      mockClientRepository
    );

    mockResponse = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      headersSent: false,
    };

    (sensitiveAccess.canAccessSensitive as jest.Mock).mockResolvedValue({
      canAccess: true,
      assignedClientIds: [clientId],
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('rejects missing/invalid birth_outcomes_induction', async () => {
    const req = {
      params: { id: clientId },
      body: {
        birth_outcomes_delivery_type: 'Emergency Cesarean',
        birth_outcomes_medications_used: ['Pitocin'],
      },
      user: { id: 'admin-id', role: ROLE.ADMIN } as any,
    } as unknown as AuthRequest;

    await clientController.updateClientBirthOutcomes(
      req,
      mockResponse as Response
    );

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: 'birth_outcomes_induction is required and must be a boolean',
      code: 'VALIDATION_ERROR',
    });
  });

  it('rejects delivery type outside allowed set', async () => {
    const req = {
      params: { id: clientId },
      body: {
        birth_outcomes_induction: false,
        birth_outcomes_delivery_type: 'Home birth',
        birth_outcomes_medications_used: ['Pitocin'],
      },
      user: { id: 'doula-id', role: ROLE.DOULA } as any,
    } as unknown as AuthRequest;

    await clientController.updateClientBirthOutcomes(
      req,
      mockResponse as Response
    );

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: 'birth_outcomes_delivery_type must be one of the allowed options',
      code: 'VALIDATION_ERROR',
    });
  });

  it('rejects empty medications array', async () => {
    const req = {
      params: { id: clientId },
      body: {
        birth_outcomes_induction: false,
        birth_outcomes_delivery_type: 'Emergency Cesarean',
        birth_outcomes_medications_used: [],
      },
      user: { id: 'admin-id', role: ROLE.ADMIN } as any,
    } as unknown as AuthRequest;

    await clientController.updateClientBirthOutcomes(
      req,
      mockResponse as Response
    );

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: 'birth_outcomes_medications_used must include at least one item',
      code: 'VALIDATION_ERROR',
    });
  });

  it('rejects invalid medication option', async () => {
    const req = {
      params: { id: clientId },
      body: {
        birth_outcomes_induction: true,
        birth_outcomes_delivery_type: 'Scheduled Cesarean',
        birth_outcomes_medications_used: ['Pitocin', 'Unknown'],
      },
      user: { id: 'admin-id', role: ROLE.ADMIN } as any,
    } as unknown as AuthRequest;

    await clientController.updateClientBirthOutcomes(
      req,
      mockResponse as Response
    );

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: 'birth_outcomes_medications_used contains invalid option(s)',
      code: 'VALIDATION_ERROR',
    });
  });

  describe('Authorization', () => {
    const validBody = {
      birth_outcomes_induction: true,
      birth_outcomes_delivery_type: 'Emergency Cesarean',
      birth_outcomes_medications_used: ['Pitocin'],
    };

    it('allows admin to update birth outcomes', async () => {
      (sensitiveAccess.canAccessSensitive as jest.Mock).mockResolvedValue({
        canAccess: true,
        assignedClientIds: [],
      });

      const req = {
        params: { id: clientId },
        body: validBody,
        user: { id: 'admin-id', role: ROLE.ADMIN } as any,
      } as unknown as AuthRequest;

      await clientController.updateClientBirthOutcomes(
        req,
        mockResponse as Response
      );

      expect(sensitiveAccess.canAccessSensitive).toHaveBeenCalledWith(
        req.user,
        clientId
      );
      expect(mockClientRepository.updateClientOperational).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });

    it('allows assigned doula to update birth outcomes', async () => {
      (sensitiveAccess.canAccessSensitive as jest.Mock).mockResolvedValue({
        canAccess: true,
        assignedClientIds: [clientId],
      });

      const req = {
        params: { id: clientId },
        body: validBody,
        user: { id: 'doula-id', role: ROLE.DOULA } as any,
      } as unknown as AuthRequest;

      await clientController.updateClientBirthOutcomes(
        req,
        mockResponse as Response
      );

      expect(mockClientRepository.updateClientOperational).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });

    it('rejects unassigned doula with 403', async () => {
      (sensitiveAccess.canAccessSensitive as jest.Mock).mockResolvedValue({
        canAccess: false,
        assignedClientIds: [],
      });

      const req = {
        params: { id: clientId },
        body: validBody,
        user: { id: 'doula-id', role: ROLE.DOULA } as any,
      } as unknown as AuthRequest;

      await clientController.updateClientBirthOutcomes(
        req,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Not authorized to update birth outcomes',
        code: 'FORBIDDEN',
      });
      expect(mockClientRepository.getClientById).not.toHaveBeenCalled();
      expect(
        mockClientRepository.updateClientOperational
      ).not.toHaveBeenCalled();
    });

    it('rejects inactive assignment (no active assign) with 403 without client lookup', async () => {
      (sensitiveAccess.canAccessSensitive as jest.Mock).mockResolvedValue({
        canAccess: false,
        assignedClientIds: [],
      });
      mockClientRepository.getClientById = jest
        .fn()
        .mockResolvedValue({ id: clientId });

      const req = {
        params: { id: clientId },
        body: validBody,
        user: {
          id: 'doula-id',
          role: ROLE.DOULA,
          account_status: 'approved',
        } as any,
      } as unknown as AuthRequest;

      await clientController.updateClientBirthOutcomes(
        req,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockClientRepository.getClientById).not.toHaveBeenCalled();
    });

    it('rejects missing authenticated user (fail-closed)', async () => {
      (sensitiveAccess.canAccessSensitive as jest.Mock).mockResolvedValue({
        canAccess: false,
        assignedClientIds: [],
      });

      const req = {
        params: { id: clientId },
        body: validBody,
        user: undefined,
      } as unknown as AuthRequest;

      await clientController.updateClientBirthOutcomes(
        req,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(
        mockClientRepository.updateClientOperational
      ).not.toHaveBeenCalled();
    });

    it('returns 404 for authorized admin when client does not exist', async () => {
      (sensitiveAccess.canAccessSensitive as jest.Mock).mockResolvedValue({
        canAccess: true,
        assignedClientIds: [],
      });
      mockClientRepository.getClientById = jest.fn().mockResolvedValue(null);

      const req = {
        params: { id: clientId },
        body: validBody,
        user: { id: 'admin-id', role: ROLE.ADMIN } as any,
      } as unknown as AuthRequest;

      await clientController.updateClientBirthOutcomes(
        req,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(
        mockClientRepository.updateClientOperational
      ).not.toHaveBeenCalled();
    });
  });

  it('writes valid structured birth outcomes to Cloud SQL', async () => {
    const req = {
      params: { id: clientId },
      body: {
        birth_outcomes_induction: true,
        birth_outcomes_delivery_type: 'Emergency Cesarean',
        birth_outcomes_medications_used: [' Pitocin ', 'Epidural'],
      },
      user: { id: 'admin-id', role: ROLE.ADMIN } as any,
    } as unknown as AuthRequest;

    await clientController.updateClientBirthOutcomes(
      req,
      mockResponse as Response
    );

    expect(mockClientRepository.updateClientOperational).toHaveBeenCalledWith(
      clientId,
      {
        birth_outcomes_induction: true,
        birth_outcomes_delivery_type: 'Emergency Cesarean',
        birth_outcomes_medications_used: ['Pitocin', 'Epidural'],
      }
    );
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: true,
      data: {
        birth_outcomes_induction: true,
        birth_outcomes_delivery_type: 'Emergency Cesarean',
        birth_outcomes_medications_used: ['Pitocin', 'Epidural'],
      },
    });
  });

  describe('Generic PUT /clients/:id', () => {
    it('rejects structured birth outcomes fields on generic update', async () => {
      const req = {
        params: { id: clientId },
        body: {
          birth_outcomes_induction: true,
          birth_outcomes_delivery_type: 'Emergency Cesarean',
          birth_outcomes_medications_used: ['Pitocin'],
        },
        user: { id: 'admin-id', role: ROLE.ADMIN } as any,
      } as unknown as AuthRequest;

      await clientController.updateClient(req, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error:
            'Birth outcomes must be updated via PUT /clients/:id/birth-outcomes',
          code: 'VALIDATION_ERROR',
        })
      );
      expect(
        mockClientRepository.updateClientOperational
      ).not.toHaveBeenCalled();
    });

    it('rejects legacy birth_outcomes narrative on generic update', async () => {
      const req = {
        params: { id: clientId },
        body: { birth_outcomes: 'Free text should not be accepted' },
        user: { id: 'admin-id', role: ROLE.ADMIN } as any,
      } as unknown as AuthRequest;

      await clientController.updateClient(req, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(
        mockClientRepository.updateClientOperational
      ).not.toHaveBeenCalled();
    });
  });
});

describe('GET /clients/:id includes structured birth outcomes (authorized)', () => {
  let clientController: ClientController;
  let mockResponse: Partial<Response>;
  let mockClientRepository: jest.Mocked<ClientRepository>;

  const clientId = '123e4567-e89b-12d3-a456-426614174000';

  beforeEach(() => {
    process.env.SPLIT_DB_READ_MODE = 'primary';

    mockClientRepository = {
      getClientById: jest.fn().mockResolvedValue({
        id: clientId,
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'jane@example.com',
        phone_number: '555-0000',
        address_line1: null,
        bio: null,
        city: null,
        state: null,
        zip_code: null,
        country: null,
        status: 'lead',
        service_needed: null,
        portal_status: null,
        invited_at: null,
        last_invite_sent_at: null,
        invite_sent_count: null,
        requested_at: null,
        updated_at: null,
      } as any),
      findClientDetailedById: jest.fn().mockResolvedValue({
        user: {
          birth_outcomes_induction: false,
          birth_outcomes_delivery_type: 'Vaginal (unmedicated)',
          birth_outcomes_medications_used: ['Nitrous Oxide'],
          referral_source: 'Midwife',
          referral_name: 'Eastside Birth Collective',
          referral_email: 'referrals@example.com',
        },
        // The controller also reads some top-level fields; keep them null/undefined-safe.
        health_history: null,
        allergies: null,
        due_date: null,
        annual_income: null,
        baby_sex: null,
      } as any),
    } as unknown as jest.Mocked<ClientRepository>;

    clientController = new ClientController(
      {} as jest.Mocked<ClientUseCase>,
      {} as jest.Mocked<SupabaseAssignmentRepository>,
      mockClientRepository
    );

    mockResponse = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      headersSent: false,
    };

    (sensitiveAccess.canAccessSensitive as jest.Mock).mockResolvedValue({
      canAccess: true,
      assignedClientIds: [clientId],
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns structured birth outcome fields when authorized', async () => {
    const req = {
      params: { id: clientId },
      user: { id: 'admin-id', role: ROLE.ADMIN } as any,
    } as unknown as AuthRequest;

    await clientController.getClientById(req, mockResponse as Response);

    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          id: clientId,
          birth_outcomes_induction: false,
          birth_outcomes_delivery_type: 'Vaginal (unmedicated)',
          birth_outcomes_medications_used: ['Nitrous Oxide'],
          referral_source: 'Midwife',
          referral_name: 'Eastside Birth Collective',
          referral_email: 'referrals@example.com',
        }),
      })
    );
  });
});
