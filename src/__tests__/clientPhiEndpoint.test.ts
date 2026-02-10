/**
 * Tests for PUT /clients/:id/phi endpoint
 *
 * Tests that the PHI-only update endpoint:
 * 1. Accepts only PHI fields
 * 2. Rejects non-PHI fields with clear error message
 * 3. Requires authorization (admin or assigned doula)
 * 4. Updates only Google Cloud SQL via PHI Broker
 */

import { Request, Response } from 'express';
import { ClientController } from '../controllers/clientController';
import { ClientUseCase } from '../usecase/clientUseCase';
import { SupabaseAssignmentRepository } from '../repositories/supabaseAssignmentRepository';
import { AuthRequest, ROLE } from '../types';
import * as phiBrokerService from '../services/phiBrokerService';
import * as sensitiveAccess from '../utils/sensitiveAccess';
import { SupabaseClientRepository } from '../repositories/supabaseClientRepository';

// Mock dependencies
jest.mock('../services/phiBrokerService');
jest.mock('../utils/sensitiveAccess');
jest.mock('../repositories/supabaseClientRepository');
jest.mock('../repositories/supabaseAssignmentRepository');
jest.mock('../usecase/clientUseCase');

describe('PUT /clients/:id/phi', () => {
  let clientController: ClientController;
  let mockRequest: Partial<AuthRequest>;
  let mockResponse: Partial<Response>;
  let mockClientUseCase: jest.Mocked<ClientUseCase>;
  let mockAssignmentRepository: jest.Mocked<SupabaseAssignmentRepository>;

  const clientId = '123e4567-e89b-12d3-a456-426614174000';

  beforeEach(() => {
    // Reset environment
    process.env.SPLIT_DB_READ_MODE = 'primary';

    // Create mocks
    mockClientUseCase = {} as jest.Mocked<ClientUseCase>;
    mockAssignmentRepository = {} as jest.Mocked<SupabaseAssignmentRepository>;
    clientController = new ClientController(mockClientUseCase, mockAssignmentRepository);

    // Mock response object
    mockResponse = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      headersSent: false,
    };

    // Mock request object (base admin user)
    mockRequest = {
      params: { id: clientId },
      body: {},
      user: {
        id: 'admin-user-id',
        role: ROLE.ADMIN,
      } as any,
    };

    // Mock SupabaseClientRepository
    const mockClientRepository = {
      getClientById: jest.fn().mockResolvedValue({
        id: clientId,
        status: 'active',
        serviceNeeded: 'Birth Support',
      }),
      updateIdentityCache: jest.fn().mockResolvedValue(undefined),
    };
    (SupabaseClientRepository as jest.Mock).mockImplementation(() => mockClientRepository);

    // Mock canAccessSensitive - default to authorized admin
    (sensitiveAccess.canAccessSensitive as jest.Mock).mockResolvedValue({
      canAccess: true,
      assignedClientIds: [],
    });

    // Mock updateClientPhi - default success
    (phiBrokerService.updateClientPhi as jest.Mock).mockResolvedValue({
      first_name: 'Jane',
      last_name: 'Doe',
      email: 'jane.doe@example.com',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Validation', () => {
    it('should accept only PHI fields', async () => {
      mockRequest.body = {
        first_name: 'Jane',
        last_name: 'Doe',
        phone_number: '555-1234',
      };

      await clientController.updateClientPhi(
        mockRequest as AuthRequest,
        mockResponse as Response
      );

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            message: 'PHI fields updated successfully',
          }),
        })
      );
      expect(phiBrokerService.updateClientPhi).toHaveBeenCalledWith(
        clientId,
        expect.any(Object),
        expect.objectContaining({
          first_name: 'Jane',
          last_name: 'Doe',
          phone_number: '555-1234',
        })
      );
    });

    it('should reject non-PHI fields', async () => {
      mockRequest.body = {
        first_name: 'Jane',
        status: 'active', // Non-PHI field
        service_needed: 'Birth Support', // Non-PHI field
      };

      await clientController.updateClientPhi(
        mockRequest as AuthRequest,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Non-PHI fields not allowed'),
        })
      );
      expect(phiBrokerService.updateClientPhi).not.toHaveBeenCalled();
    });

    it('should reject empty request body', async () => {
      mockRequest.body = {};

      await clientController.updateClientPhi(
        mockRequest as AuthRequest,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'No fields to update',
        })
      );
    });

    it('should reject invalid client ID format', async () => {
      mockRequest.params = { id: 'invalid-uuid' };
      mockRequest.body = { first_name: 'Jane' };

      await clientController.updateClientPhi(
        mockRequest as AuthRequest,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('Invalid client ID format'),
        })
      );
    });

    it('should reject if client not found', async () => {
      const mockClientRepository = {
        getClientById: jest.fn().mockResolvedValue(null),
        updateIdentityCache: jest.fn(),
      };
      (SupabaseClientRepository as jest.Mock).mockImplementation(() => mockClientRepository);

      mockRequest.body = { first_name: 'Jane' };

      await clientController.updateClientPhi(
        mockRequest as AuthRequest,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Client not found',
        })
      );
    });
  });

  describe('Authorization', () => {
    it('should allow admin to update PHI', async () => {
      mockRequest.user = { id: 'admin-id', role: ROLE.ADMIN } as any;
      mockRequest.body = { first_name: 'Jane' };

      (sensitiveAccess.canAccessSensitive as jest.Mock).mockResolvedValue({
        canAccess: true,
        assignedClientIds: [],
      });

      await clientController.updateClientPhi(
        mockRequest as AuthRequest,
        mockResponse as Response
      );

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );
    });

    it('should allow assigned doula to update PHI', async () => {
      mockRequest.user = { id: 'doula-id', role: ROLE.DOULA } as any;
      mockRequest.body = { first_name: 'Jane' };

      (sensitiveAccess.canAccessSensitive as jest.Mock).mockResolvedValue({
        canAccess: true,
        assignedClientIds: [clientId],
      });

      await clientController.updateClientPhi(
        mockRequest as AuthRequest,
        mockResponse as Response
      );

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );
    });

    it('should reject unauthorized doula (not assigned)', async () => {
      mockRequest.user = { id: 'doula-id', role: ROLE.DOULA } as any;
      mockRequest.body = { first_name: 'Jane' };

      (sensitiveAccess.canAccessSensitive as jest.Mock).mockResolvedValue({
        canAccess: false,
        assignedClientIds: [],
      });

      await clientController.updateClientPhi(
        mockRequest as AuthRequest,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Not authorized to update PHI fields',
        })
      );
      expect(phiBrokerService.updateClientPhi).not.toHaveBeenCalled();
    });

    it('should reject non-admin, non-doula roles', async () => {
      mockRequest.user = { id: 'client-id', role: ROLE.CLIENT } as any;
      mockRequest.body = { first_name: 'Jane' };

      (sensitiveAccess.canAccessSensitive as jest.Mock).mockResolvedValue({
        canAccess: false,
        assignedClientIds: [],
      });

      await clientController.updateClientPhi(
        mockRequest as AuthRequest,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(phiBrokerService.updateClientPhi).not.toHaveBeenCalled();
    });
  });

  describe('PHI Field Normalization', () => {
    it('should normalize camelCase to snake_case', async () => {
      mockRequest.body = {
        firstName: 'Jane', // camelCase
        lastName: 'Doe', // camelCase
        phoneNumber: '555-1234', // camelCase
      };

      await clientController.updateClientPhi(
        mockRequest as AuthRequest,
        mockResponse as Response
      );

      expect(phiBrokerService.updateClientPhi).toHaveBeenCalledWith(
        clientId,
        expect.any(Object),
        expect.objectContaining({
          first_name: 'Jane',
          last_name: 'Doe',
          phone_number: '555-1234',
        })
      );
    });

    it('should handle nested user object', async () => {
      mockRequest.body = {
        user: {
          firstname: 'Jane',
          lastname: 'Doe',
        },
      };

      await clientController.updateClientPhi(
        mockRequest as AuthRequest,
        mockResponse as Response
      );

      expect(phiBrokerService.updateClientPhi).toHaveBeenCalledWith(
        clientId,
        expect.any(Object),
        expect.objectContaining({
          first_name: 'Jane',
          last_name: 'Doe',
        })
      );
    });
  });

  describe('PHI Broker Integration', () => {
    it('should call PHI Broker with correct parameters', async () => {
      mockRequest.body = {
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'jane@example.com',
        health_history: 'No known conditions',
      };

      await clientController.updateClientPhi(
        mockRequest as AuthRequest,
        mockResponse as Response
      );

      expect(phiBrokerService.updateClientPhi).toHaveBeenCalledWith(
        clientId,
        {
          role: 'admin',
          userId: 'admin-user-id',
          assignedClientIds: [],
        },
        {
          first_name: 'Jane',
          last_name: 'Doe',
          email: 'jane@example.com',
          health_history: 'No known conditions',
        }
      );
    });

    it('should update identity cache for name/email/phone changes', async () => {
      const mockClientRepository = {
        getClientById: jest.fn().mockResolvedValue({ id: clientId }),
        updateIdentityCache: jest.fn().mockResolvedValue(undefined),
      };
      (SupabaseClientRepository as jest.Mock).mockImplementation(() => mockClientRepository);

      mockRequest.body = {
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'jane@example.com',
      };

      await clientController.updateClientPhi(
        mockRequest as AuthRequest,
        mockResponse as Response
      );

      expect(mockClientRepository.updateIdentityCache).toHaveBeenCalledWith(
        clientId,
        {
          first_name: 'Jane',
          last_name: 'Doe',
          email: 'jane@example.com',
          phone_number: undefined,
        }
      );
    });

    it('should NOT update identity cache for non-identity PHI fields', async () => {
      const mockClientRepository = {
        getClientById: jest.fn().mockResolvedValue({ id: clientId }),
        updateIdentityCache: jest.fn().mockResolvedValue(undefined),
      };
      (SupabaseClientRepository as jest.Mock).mockImplementation(() => mockClientRepository);

      mockRequest.body = {
        health_history: 'No known conditions',
        allergies: 'Peanuts',
      };

      await clientController.updateClientPhi(
        mockRequest as AuthRequest,
        mockResponse as Response
      );

      expect(mockClientRepository.updateIdentityCache).not.toHaveBeenCalled();
    });
  });

  describe('Environment Mode', () => {
    it('should reject when not in PRIMARY mode', async () => {
      process.env.SPLIT_DB_READ_MODE = 'shadow';
      mockRequest.body = { first_name: 'Jane' };

      await clientController.updateClientPhi(
        mockRequest as AuthRequest,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(501);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Shadow disabled',
        })
      );
    });
  });
});
