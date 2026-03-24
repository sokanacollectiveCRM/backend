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

describe('Client billing endpoints', () => {
  let clientController: ClientController;
  let mockResponse: Partial<Response>;
  let mockClientRepository: jest.Mocked<ClientRepository>;
  const clientId = '123e4567-e89b-12d3-a456-426614174000';

  beforeEach(() => {
    process.env.SPLIT_DB_READ_MODE = 'primary';

    mockClientRepository = {
      getClientBilling: jest.fn(),
      updateClientBilling: jest.fn(),
      getClientById: jest.fn(),
    } as unknown as jest.Mocked<ClientRepository>;

    clientController = new ClientController(
      {} as jest.Mocked<ClientUseCase>,
      {} as jest.Mocked<SupabaseAssignmentRepository>,
      mockClientRepository
    );

    (clientController as any).cloudSqlAssignmentService = {
      getClientIdByAuthUserId: jest.fn().mockResolvedValue(clientId),
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

  it('updates staff/admin billing and clears insurance fields for Self-Pay', async () => {
    const updatedAt = '2026-03-24T12:00:00.000Z';
    mockClientRepository.updateClientBilling!.mockResolvedValue({
      id: clientId,
      payment_method: 'Self-Pay',
      insurance_provider: null,
      insurance_member_id: null,
      policy_number: null,
      self_pay_card_info: 'Visa ending 4242',
      updated_at: updatedAt,
    } as any);

    const req = {
      params: { id: clientId },
      body: {
        payment_method: 'Self-Pay',
        insurance_provider: 'Aetna',
        insurance_member_id: 'MID-1',
        policy_number: 'POL-1',
        self_pay_card_info: 'Visa ending 4242',
      },
      user: { id: 'admin-user-id', role: ROLE.ADMIN } as any,
    } as unknown as AuthRequest;

    await clientController.updateClientBilling(req, mockResponse as Response);

    expect(mockClientRepository.updateClientBilling).toHaveBeenCalledWith(clientId, {
      payment_method: 'Self-Pay',
      insurance_provider: null,
      insurance_member_id: null,
      policy_number: null,
      self_pay_card_info: 'Visa ending 4242',
    });
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: true,
      data: {
        payment_method: 'Self-Pay',
        insurance_provider: null,
        insurance_member_id: null,
        policy_number: null,
        self_pay_card_info: 'Visa ending 4242',
        updated_at: updatedAt,
      },
    });
  });

  it('updates client portal billing and clears self-pay card info for insurance methods', async () => {
    const updatedAt = '2026-03-24T13:00:00.000Z';
    mockClientRepository.updateClientBilling!.mockResolvedValue({
      id: clientId,
      payment_method: 'Private Insurance',
      insurance_provider: 'Blue Cross',
      insurance_member_id: 'MEM-123',
      policy_number: 'POL-456',
      self_pay_card_info: null,
      updated_at: updatedAt,
    } as any);

    const req = {
      params: {},
      body: {
        payment_method: 'Private Insurance',
        insurance_provider: 'Blue Cross',
        insurance_member_id: 'MEM-123',
        policy_number: 'POL-456',
        self_pay_card_info: 'should be cleared',
      },
      user: { id: 'client-auth-id', role: ROLE.CLIENT } as any,
    } as unknown as AuthRequest;

    await clientController.updateClientBilling(req, mockResponse as Response);

    expect(mockClientRepository.updateClientBilling).toHaveBeenCalledWith(clientId, {
      payment_method: 'Private Insurance',
      insurance_provider: 'Blue Cross',
      insurance_member_id: 'MEM-123',
      policy_number: 'POL-456',
      self_pay_card_info: null,
    });
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: true,
      data: {
        payment_method: 'Private Insurance',
        insurance_provider: 'Blue Cross',
        insurance_member_id: 'MEM-123',
        policy_number: 'POL-456',
        self_pay_card_info: null,
        updated_at: updatedAt,
      },
    });
  });

  it('returns billing data on GET after PUT-shaped repository data', async () => {
    const updatedAt = '2026-03-24T14:00:00.000Z';
    mockClientRepository.getClientBilling!.mockResolvedValue({
      id: clientId,
      payment_method: 'Medicaid',
      insurance_provider: 'State Plan',
      insurance_member_id: 'ABC123',
      policy_number: 'POLICY9',
      self_pay_card_info: null,
      updated_at: updatedAt,
    } as any);

    const req = {
      params: { id: clientId },
      user: { id: 'doula-id', role: ROLE.DOULA } as any,
    } as unknown as AuthRequest;

    await clientController.getClientBilling(req, mockResponse as Response);

    expect(mockResponse.json).toHaveBeenCalledWith({
      success: true,
      data: {
        payment_method: 'Medicaid',
        insurance_provider: 'State Plan',
        insurance_member_id: 'ABC123',
        policy_number: 'POLICY9',
        self_pay_card_info: null,
        updated_at: updatedAt,
      },
    });
  });

  it('rejects unauthorized staff access with 403', async () => {
    (sensitiveAccess.canAccessSensitive as jest.Mock).mockResolvedValue({
      canAccess: false,
      assignedClientIds: [],
    });

    const req = {
      params: { id: clientId },
      body: { payment_method: 'Self-Pay', self_pay_card_info: 'Visa' },
      user: { id: 'unassigned-doula', role: ROLE.DOULA } as any,
    } as unknown as AuthRequest;

    await clientController.updateClientBilling(req, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: 'Forbidden',
      code: 'FORBIDDEN',
    });
    expect(mockClientRepository.updateClientBilling).not.toHaveBeenCalled();
  });

  it('rejects invalid billing combinations server-side', async () => {
    const req = {
      params: { id: clientId },
      body: {
        payment_method: 'Self-Pay',
        self_pay_card_info: '   ',
      },
      user: { id: 'admin-user-id', role: ROLE.ADMIN } as any,
    } as unknown as AuthRequest;

    await clientController.updateClientBilling(req, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: 'self_pay_card_info is required when payment_method is Self-Pay',
      code: 'VALIDATION_ERROR',
    });
  });
});
