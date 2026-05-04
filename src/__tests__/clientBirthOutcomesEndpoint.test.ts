import { Response } from 'express';
import { ClientController } from '../controllers/clientController';
import { ClientUseCase } from '../usecase/clientUseCase';
import { SupabaseAssignmentRepository } from '../repositories/supabaseAssignmentRepository';
import { ClientRepository } from '../repositories/interface/clientRepository';
import { AuthRequest, ROLE } from '../types';
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
      updateClientOperational: jest.fn().mockResolvedValue({ id: clientId } as any),
      findClientDetailedById: jest.fn().mockResolvedValue({
        user: {
          birth_outcomes: 'Legacy narrative',
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

    await clientController.updateClientBirthOutcomes(req, mockResponse as Response);

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

    await clientController.updateClientBirthOutcomes(req, mockResponse as Response);

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

    await clientController.updateClientBirthOutcomes(req, mockResponse as Response);

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

    await clientController.updateClientBirthOutcomes(req, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: 'birth_outcomes_medications_used contains invalid option(s)',
      code: 'VALIDATION_ERROR',
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

    await clientController.updateClientBirthOutcomes(req, mockResponse as Response);

    expect(mockClientRepository.updateClientOperational).toHaveBeenCalledWith(clientId, {
      birth_outcomes_induction: true,
      birth_outcomes_delivery_type: 'Emergency Cesarean',
      birth_outcomes_medications_used: ['Pitocin', 'Epidural'],
    });
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: true,
      data: {
        birth_outcomes_induction: true,
        birth_outcomes_delivery_type: 'Emergency Cesarean',
        birth_outcomes_medications_used: ['Pitocin', 'Epidural'],
      },
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
          birth_outcomes: 'Legacy narrative',
          birth_outcomes_induction: false,
          birth_outcomes_delivery_type: 'Vaginal (unmedicated)',
          birth_outcomes_medications_used: ['Nitrous Oxide'],
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

  it('returns legacy birth_outcomes plus structured fields', async () => {
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
          birth_outcomes: 'Legacy narrative',
          birth_outcomes_induction: false,
          birth_outcomes_delivery_type: 'Vaginal (unmedicated)',
          birth_outcomes_medications_used: ['Nitrous Oxide'],
        }),
      })
    );
  });
});

