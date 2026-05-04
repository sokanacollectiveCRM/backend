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

describe('Client billing/profile validation split', () => {
  let clientController: ClientController;
  let mockResponse: Partial<Response>;
  let mockClientRepository: jest.Mocked<ClientRepository>;
  const clientId = '123e4567-e89b-12d3-a456-426614174000';

  beforeEach(() => {
    process.env.SPLIT_DB_READ_MODE = 'primary';

    mockClientRepository = {
      getClientById: jest.fn(),
      updateClientBilling: jest.fn(),
      updateClientOperational: jest.fn(),
      findClientDetailedById: jest.fn(),
    } as unknown as jest.Mocked<ClientRepository>;

    clientController = new ClientController(
      {} as jest.Mocked<ClientUseCase>,
      {} as jest.Mocked<SupabaseAssignmentRepository>,
      mockClientRepository
    );

    (clientController as any).eligibilityService = {
      getInviteEligibility: jest.fn().mockResolvedValue({ eligible: false }),
    };

    (clientController as any).cloudSqlAssignmentService = {
      getClientIdByAuthUserId: jest.fn().mockResolvedValue(clientId),
    };

    (clientController as any).clientDocumentRepository = {
      getDocumentsByClientId: jest.fn().mockResolvedValue([
        {
          id: 'doc-1',
          clientId,
          documentType: 'insurance_card',
          category: 'billing',
          fileName: 'insurance-card.pdf',
          filePath: 'client-documents/insurance-card.pdf',
          uploadedAt: new Date('2026-03-24T10:00:00.000Z'),
          status: 'uploaded',
          createdAt: new Date('2026-03-24T10:00:00.000Z'),
          updatedAt: new Date('2026-03-24T10:00:00.000Z'),
        },
      ]),
    };

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

  it('updates billing even when an unrelated zip_code value is invalid', async () => {
    const updatedAt = '2026-03-24T12:00:00.000Z';

    mockClientRepository.updateClientBilling!.mockResolvedValue({
      id: clientId,
      payment_method: 'Self-Pay',
      insurance: null,
      insurance_provider: null,
      insurance_member_id: null,
      policy_number: null,
      insurance_phone_number: null,
      has_secondary_insurance: false,
      secondary_insurance_provider: null,
      secondary_insurance_member_id: null,
      secondary_policy_number: null,
      self_pay_card_info: 'Visa ending 4242',
      updated_at: updatedAt,
    } as any);

    mockClientRepository.getClientById!.mockResolvedValue({
      id: clientId,
      client_number: null,
      first_name: 'Jane',
      last_name: 'Doe',
      email: 'jane@example.com',
      phone_number: '555-1234',
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
      updated_at: updatedAt,
      payment_method: 'Self-Pay',
      insurance_provider: null,
      insurance_member_id: null,
      policy_number: null,
      self_pay_card_info: 'Visa ending 4242',
    } as any);

    const req = {
      params: { id: clientId },
      body: {
        payment_method: 'Self-Pay',
        self_pay_card_info: 'Visa ending 4242',
        zip_code: 'invalid-zip',
      },
      user: { id: 'client-auth-id', role: ROLE.CLIENT } as any,
    } as unknown as AuthRequest;

    await clientController.updateClient(req, mockResponse as Response);

    expect(mockClientRepository.updateClientBilling).toHaveBeenCalledWith(clientId, {
      payment_method: 'Self-Pay',
      insurance: null,
      insurance_provider: null,
      insurance_member_id: null,
      policy_number: null,
      insurance_phone_number: null,
      has_secondary_insurance: false,
      secondary_insurance_provider: null,
      secondary_insurance_member_id: null,
      secondary_policy_number: null,
      self_pay_card_info: 'Visa ending 4242',
    });
    expect(mockClientRepository.updateClientOperational).not.toHaveBeenCalled();
    expect(mockResponse.status).not.toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: true,
      data: expect.objectContaining({
        payment_method: 'Self-Pay',
        self_pay_card_info: 'Visa ending 4242',
        updated_at: updatedAt,
      }),
    });
  });

  it('rejects invalid zip_code when profile address data is actually being updated', async () => {
    const req = {
      params: { id: clientId },
      body: {
        address_line1: '123 Main St',
        city: 'Chicago',
        state: 'IL',
        zip_code: 'invalid-zip',
      },
      user: { id: 'admin-user-id', role: ROLE.ADMIN } as any,
    } as unknown as AuthRequest;

    await clientController.updateClient(req, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: 'zip_code must be a valid ZIP code',
      code: 'VALIDATION_ERROR',
    });
    expect(mockClientRepository.updateClientBilling).not.toHaveBeenCalled();
    expect(mockClientRepository.updateClientOperational).not.toHaveBeenCalled();
  });

  it('rejects insurance billing updates without an insurance card upload', async () => {
    (clientController as any).clientDocumentRepository = {
      getDocumentsByClientId: jest.fn().mockResolvedValue([]),
    };

    const req = {
      params: { id: clientId },
      body: {
        payment_method: 'Commercial Insurance',
        insurance_provider: 'Aetna',
        insurance_member_id: 'MEM-123',
        policy_number: 'POL-456',
      },
      user: { id: 'client-auth-id', role: ROLE.CLIENT } as any,
    } as unknown as AuthRequest;

    await clientController.updateClient(req, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: 'An insurance card upload is required before saving insurance billing',
      code: 'VALIDATION_ERROR',
    });
    expect(mockClientRepository.updateClientBilling).not.toHaveBeenCalled();
    expect(mockClientRepository.updateClientOperational).not.toHaveBeenCalled();
  });

  it('accepts numeric zip_code values when profile address data is being updated', async () => {
    const updatedAt = '2026-03-24T15:00:00.000Z';

    mockClientRepository.updateClientOperational!.mockResolvedValue({
      id: clientId,
      client_number: null,
      first_name: 'Jane',
      last_name: 'Doe',
      email: 'jane@example.com',
      phone_number: '555-1234',
      address_line1: '123 Main St',
      bio: null,
      city: 'Chicago',
      state: 'IL',
      zip_code: '60614',
      country: null,
      status: 'lead',
      service_needed: null,
      portal_status: null,
      invited_at: null,
      last_invite_sent_at: null,
      invite_sent_count: null,
      requested_at: null,
      updated_at: updatedAt,
    } as any);
    mockClientRepository.getClientById!.mockResolvedValue({
      id: clientId,
      client_number: null,
      first_name: 'Jane',
      last_name: 'Doe',
      email: 'jane@example.com',
      phone_number: '555-1234',
      address_line1: '123 Main St',
      bio: null,
      city: 'Chicago',
      state: 'IL',
      zip_code: '60614',
      country: null,
      status: 'lead',
      service_needed: null,
      portal_status: null,
      invited_at: null,
      last_invite_sent_at: null,
      invite_sent_count: null,
      requested_at: null,
      updated_at: updatedAt,
    } as any);

    const req = {
      params: { id: clientId },
      body: {
        address_line1: '123 Main St',
        city: 'Chicago',
        state: 'IL',
        zip_code: 60614,
      },
      user: { id: 'client-auth-id', role: ROLE.CLIENT } as any,
    } as unknown as AuthRequest;

    await clientController.updateClient(req, mockResponse as Response);

    expect(mockClientRepository.updateClientOperational).toHaveBeenCalledWith(
      clientId,
      expect.objectContaining({
        address_line1: '123 Main St',
        city: 'Chicago',
        state: 'IL',
        zip_code: '60614',
      })
    );
    expect(mockResponse.status).not.toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: true,
      data: expect.objectContaining({
        zipCode: '60614',
        updated_at: updatedAt,
      }),
    });
  });

  it('returns billing fields on client profile refresh after an update', async () => {
    mockClientRepository.getClientById!.mockResolvedValue({
      id: clientId,
      client_number: 'CL-00001',
      first_name: 'Jane',
      last_name: 'Doe',
      email: 'jane@example.com',
      phone_number: '555-1234',
      address_line1: '123 Main St',
      bio: null,
      city: 'Chicago',
      state: 'IL',
      zip_code: '60614',
      country: 'US',
      status: 'lead',
      service_needed: 'Labor Support',
      portal_status: 'not_invited',
      invited_at: null,
      last_invite_sent_at: null,
      invite_sent_count: null,
      requested_at: null,
      updated_at: '2026-03-24T16:00:00.000Z',
      payment_method: 'Commercial Insurance',
      insurance: 'Blue Cross Blue Shield',
      insurance_provider: 'Blue Cross Blue Shield',
      insurance_member_id: 'MEM-12345',
      policy_number: 'POL-67890',
      insurance_phone_number: '800-555-1212',
      has_secondary_insurance: true,
      secondary_insurance_provider: 'Kaiser Secondary',
      secondary_insurance_member_id: 'SEC-12345',
      secondary_policy_number: 'SEC-POL-1',
      self_pay_card_info: null,
    } as any);

    mockClientRepository.findClientDetailedById!.mockResolvedValue({
      user: {
        insurance: 'Blue Cross Blue Shield',
        payment_method: 'Commercial Insurance',
        insurance_provider: 'Blue Cross Blue Shield',
        insurance_member_id: 'MEM-12345',
        policy_number: 'POL-67890',
        insurance_phone_number: '800-555-1212',
        has_secondary_insurance: true,
        secondary_insurance_provider: 'Kaiser Secondary',
        secondary_insurance_member_id: 'SEC-12345',
        secondary_policy_number: 'SEC-POL-1',
        self_pay_card_info: null,
      },
    } as any);

    const req = {
      params: { id: clientId },
      user: { id: 'admin-user-id', role: ROLE.ADMIN } as any,
    } as unknown as AuthRequest;

    await clientController.getClientById(req, mockResponse as Response);

    expect(mockResponse.json).toHaveBeenCalledWith({
      success: true,
      data: expect.objectContaining({
        payment_method: 'Commercial Insurance',
        insurance: 'Blue Cross Blue Shield',
        insurance_provider: 'Blue Cross Blue Shield',
        insurance_member_id: 'MEM-12345',
        policy_number: 'POL-67890',
        insurance_phone_number: '800-555-1212',
        has_secondary_insurance: true,
        secondary_insurance_provider: 'Kaiser Secondary',
        secondary_insurance_member_id: 'SEC-12345',
        secondary_policy_number: 'SEC-POL-1',
      }),
    });
  });
});
