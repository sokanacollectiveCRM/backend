import { Response } from 'express';
import {
    AuthenticationError,
    AuthorizationError,
    ConflictError,
    NotFoundError,
    ValidationError
} from '../domains/errors';
import { Client } from '../entities/Client';

import { AuthRequest } from '../types';
import { ClientUseCase } from '../usecase/clientUseCase';
import { SupabaseAssignmentRepository } from '../repositories/supabaseAssignmentRepository';
import { SupabaseClientRepository } from '../repositories/supabaseClientRepository';
import { SupabaseActivityRepository } from '../repositories/supabaseActivityRepository';
import { PortalEligibilityService } from '../services/portalEligibilityService';
import supabase from '../supabase';
import { ClientMapper } from '../mappers/ClientMapper';
import { ActivityMapper } from '../mappers/ActivityMapper';
import { ApiResponse } from '../utils/responseBuilder';
import { canAccessSensitive } from '../utils/sensitiveAccess';
import { fetchClientPhi, PhiBrokerError } from '../services/phiBrokerService';

export class ClientController {
  private clientUseCase: ClientUseCase;
  private assignmentRepository: SupabaseAssignmentRepository;
  private eligibilityService: PortalEligibilityService;

  constructor (clientUseCase: ClientUseCase, assignmentRepository: SupabaseAssignmentRepository) {
    this.clientUseCase = clientUseCase;
    this.assignmentRepository = assignmentRepository;
    this.eligibilityService = new PortalEligibilityService(supabase);
  };

  //
  // getClients()
  //
  // Grabs all clients (lite or detailed) based on role or query param
  //
  // returns:
  //    Clients[]
  //
  async getClients(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id, role } = req.user;
      const { detailed } = req.query;
      const readMode = process.env.SPLIT_DB_READ_MODE;

      const clients = detailed === 'true'
        ? await this.clientUseCase.getClientsDetailed(id, role)
        : await this.clientUseCase.getClientsLite(id, role);

      // Canonical response format for split-DB primary mode
      if (readMode === 'primary') {
        // Compute eligibility and map to DTOs
        const dtos = await Promise.all(
          clients.map(async (client) => {
            let isEligible = false;
            try {
              const eligibility = await this.eligibilityService.getInviteEligibility(client.id);
              isEligible = eligibility.eligible;
            } catch (error) {
              console.error(`Error checking eligibility for client ${client.id}:`, error);
            }
            return ClientMapper.toListItemDTO(client, isEligible);
          })
        );

        res.json(ApiResponse.list(dtos, dtos.length));
        return;
      }

      // Legacy response format (raw array) for non-primary modes
      // Note: Avoid logging client data - HIPAA compliance

      // Compute eligibility for each client and add to response
      const clientsWithEligibility = await Promise.all(
        clients.map(async (client) => {
          const clientJson = client.toJson() as any;
          try {
            const eligibility = await this.eligibilityService.getInviteEligibility(client.id);
            clientJson.is_eligible = eligibility.eligible;
          } catch (error) {
            // If eligibility check fails, default to false
            console.error(`Error checking eligibility for client ${client.id}:`, error);
            clientJson.is_eligible = false;
          }
          return clientJson;
        })
      );

      res.json(clientsWithEligibility);
    } catch (getError) {
      const error = this.handleError(getError, res);
      if (!res.headersSent) {
        res.status(error.status).json({ error: error.message });
      }
    }
  }
//
  // getCSVClients()
  //
  // Grabs all client data in CSV form
  //
  // returns:
  //    CSV of users
  //
  async exportCSV(
    req: AuthRequest,
    res: Response,
  ): Promise<void> {
    try {
      const {role} = req.user;
      const clientsCSV = await this.clientUseCase.exportCSV(role);
      res.header("Content-Type", "text/csv");
      res.attachment("clients.csv");

      res.send(clientsCSV);
    }
    catch (getError) {
      const error = this.handleError(getError, res);

      if (!res.headersSent) {
        res.status(error.status).json({ error: error.message})
      }
    }
  }

  //
  // getClientById()
  //
  // Grab a specific client with detailed information.
  // Includes PHI fields from PHI Broker (Cloud SQL) when user is authorized.
  //
  // Authorization for PHI:
  // - admin: Always authorized
  // - doula: Authorized only if assigned to client
  // - other: PHI fields omitted
  //
  // returns:
  //    ClientDetailDTO (operational fields always; PHI fields when authorized)
  //
  async getClientById(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const readMode = process.env.SPLIT_DB_READ_MODE;

    // Require PRIMARY mode - shadow mode disabled
    if (readMode !== 'primary') {
      res.status(501).json(ApiResponse.error('Shadow disabled', 'SHADOW_DISABLED'));
      return;
    }

    // Step 1: Validate client ID
    if (!id) {
      res.status(400).json(ApiResponse.error('Missing client ID', 'VALIDATION_ERROR'));
      return;
    }

    // Step 2: Fetch operational data from Supabase (explicit columns, no PHI)
    const clientRepository = new SupabaseClientRepository(supabase);
    const clientRow = await clientRepository.getClientById(id);

    // Step 3: Handle not found
    if (!clientRow) {
      res.status(404).json(ApiResponse.error('Client not found', 'NOT_FOUND'));
      return;
    }

    // Step 4: Compute eligibility (optional, swallow errors)
    let isEligible = false;
    try {
      const eligibility = await this.eligibilityService.getInviteEligibility(id);
      isEligible = eligibility.eligible;
    } catch (eligibilityError) {
      // HIPAA: Do not log client identifiers, only generic error
      console.error('Error checking eligibility');
    }

    // Step 5: Map operational data to DTO
    const dto = ClientMapper.toDetailDTO(clientRow, isEligible);

    // Step 6: Check authorization for sensitive/PHI data
    const { canAccess, assignedClientIds } = await canAccessSensitive(req.user, id);

    // Step 7: Branch based on authorization
    if (!canAccess) {
      // Unauthorized: Return operational-only DTO (PHI fields omitted)
      res.json(ApiResponse.success(dto));
      return;
    }

    // Authorized: Fetch PHI from PHI Broker service
    try {
      const phiData = await fetchClientPhi(id, {
        role: req.user?.role || '',
        userId: req.user?.id || '',
        assignedClientIds,
      });

      // Merge PHI fields into response (spread operator keeps only present keys)
      const merged = { ...dto, ...phiData };

      // HIPAA: Do NOT log merged which may contain PHI
      res.json(ApiResponse.success(merged));
    } catch (brokerError) {
      // PHI Broker failed - return 502
      if (brokerError instanceof PhiBrokerError) {
        console.error('[ClientController] PHI Broker unavailable');
        res.status(502).json(ApiResponse.error('Upstream PHI service unavailable', 'PHI_BROKER_ERROR'));
        return;
      }
      throw brokerError;
    }
  } catch (error) {
    // HIPAA: Do not log error details which may contain client data
    const err = this.handleError(error, res);
    if (!res.headersSent) {
      res.status(err.status).json(ApiResponse.error(err.message));
    }
  }
}

  async deleteClient(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.body;
    console.log('DELETE /clients/delete called with id:', id);
    if (!id) {
      console.log('No client ID provided');
      res.status(400).json({ error: 'Missing client ID' });
      return;
    }
    try {
      await this.clientUseCase.deleteClient(id);
      console.log('Client deleted successfully:', id);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting client:', error);
      const err = this.handleError(error, res);
      res.status(err.status).json({ error: err.message });
    }
  }

  //
  // updateClientStatus
  //
  // Updates client status in client_info table by grabbing the client to update in the request body
  //
  // returns:
  //    Client with updatedAt timestamp (or ClientDetailDTO in canonical mode)
  //
  async updateClientStatus(
    req: AuthRequest,
    res: Response,
  ): Promise<void> {
    const { clientId, status } = req.body;
    const readMode = process.env.SPLIT_DB_READ_MODE;

    // Require PRIMARY mode - shadow mode disabled
    if (readMode !== 'primary') {
      res.status(501).json(ApiResponse.error('Shadow disabled', 'SHADOW_DISABLED'));
      return;
    }

    // Validate request body
    if (!clientId || typeof clientId !== 'string') {
      res.status(400).json(ApiResponse.error('Invalid request: clientId is required and must be a string', 'VALIDATION_ERROR'));
      return;
    }

    if (!status || typeof status !== 'string' || status.trim() === '') {
      res.status(400).json(ApiResponse.error('Invalid request: status is required and must be a non-empty string', 'VALIDATION_ERROR'));
      return;
    }

    try {
      // Use repository with explicit SELECT columns (no select('*'), no PHI)
      const clientRepository = new SupabaseClientRepository(supabase);
      const updatedRow = await clientRepository.updateClientStatusCanonical(clientId, status.trim());

      if (!updatedRow) {
        res.status(404).json(ApiResponse.error('Client not found', 'NOT_FOUND'));
        return;
      }

      // Compute eligibility (optional, swallow errors)
      let isEligible = false;
      try {
        const eligibility = await this.eligibilityService.getInviteEligibility(clientId);
        isEligible = eligibility.eligible;
      } catch {
        // HIPAA: Do not log client identifiers
        console.error('Error checking eligibility');
      }

      // Map to DTO and return canonical response
      const dto = ClientMapper.toDetailDTO(updatedRow, isEligible);
      res.json(ApiResponse.success(dto));
    }
    catch (statusError) {
      const error = this.handleError(statusError, res);
      res.status(error.status).json(ApiResponse.error(error.message));
    }
  }

  //
  // updateClient
  //
  // Updates client profile fields
  //
  // returns:
  //    Client with updatedAt timestamp
  //
  async updateClient(
    req: AuthRequest,
    res: Response,
  ): Promise<void> {
    const { id } = req.params;
    const updateData = req.body;

    console.log('🔧 PUT /clients/:id - UPDATE REQUEST START');
    console.log('Controller: Request details:', {
      method: req.method,
      url: req.url,
      originalUrl: req.originalUrl,
      path: req.path,
      params: req.params,
      id,
      idType: typeof id
    });

    if (!id) {
      res.status(400).json({ error: 'Missing client ID' });
      return;
    }

    // Validate that id looks like a UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      console.error('Controller: Invalid client ID format:', id);
      res.status(400).json({ error: `Invalid client ID format: ${id}. Expected UUID format.` });
      return;
    }

    console.log('📝 Controller: Frontend sent these fields to update:', {
      clientId: id,
      updateDataKeys: Object.keys(updateData),
      updateDataCount: Object.keys(updateData).length
    });

    // Log specific fields we're looking for
    const importantFields = [
      'preferred_contact_method', 'preferred_name', 'pronouns', 'home_type',
      'services_interested', 'phoneNumber', 'phone_number', 'firstname', 'lastname', 'email'
    ];

    console.log('🎯 Controller: Checking for important fields in request:');
    importantFields.forEach(field => {
      if (updateData[field] !== undefined) {
        console.log(`  ✅ ${field}: "${updateData[field]}" (${typeof updateData[field]})`);
      } else {
        console.log(`  ❌ ${field}: undefined`);
      }
    });

    try {
      const client = await this.clientUseCase.updateClientProfile(
        id,
        updateData
      );

      console.log('✅ Controller: Client updated successfully in database');
      console.log('📊 Controller: Full client object returned from use case:', {
        clientId: client.id,
        userObjectKeys: Object.keys(client.user),
        userObjectKeyCount: Object.keys(client.user).length,
        clientFields: {
          serviceNeeded: client.serviceNeeded,
          status: client.status,
          phoneNumber: client.phoneNumber
        }
      });

      // Log what we're about to send back to frontend
      const responseData = {
        success: true,
        client: {
          // Basic client info
          id: client.id,
          updatedAt: client.updatedAt,
          status: client.status,
          serviceNeeded: client.serviceNeeded,
          requestedAt: client.requestedAt,
          phoneNumber: client.phoneNumber,

          // All user/profile fields from client_info table
          firstname: client.user.firstname,
          lastname: client.user.lastname,
          email: client.user.email,
          role: client.user.role,

          // All the fields that were missing from responses
          preferred_contact_method: client.user.preferred_contact_method,
          preferred_name: client.user.preferred_name,
          payment_method: client.user.payment_method,  // Add this field
          pronouns: client.user.pronouns,
          home_type: client.user.home_type,
          services_interested: client.user.services_interested,
          phone_number: client.user.phone_number,
          health_notes: client.user.health_notes,
          service_specifics: client.user.service_specifics,
          baby_sex: client.user.baby_sex,
          baby_name: client.user.baby_name,
          birth_hospital: client.user.birth_hospital,
          birth_location: client.user.birth_location,
          number_of_babies: client.user.number_of_babies,
          provider_type: client.user.provider_type,
          pregnancy_number: client.user.pregnancy_number,
          had_previous_pregnancies: client.user.had_previous_pregnancies,
          previous_pregnancies_count: client.user.previous_pregnancies_count,
          living_children_count: client.user.living_children_count,
          past_pregnancy_experience: client.user.past_pregnancy_experience,
          service_support_details: client.user.service_support_details,
          race_ethnicity: client.user.race_ethnicity,
          primary_language: client.user.primary_language,
          client_age_range: client.user.client_age_range,
          insurance: client.user.insurance,
          demographics_multi: client.user.demographics_multi,
          pronouns_other: client.user.pronouns_other,
          home_phone: client.user.home_phone,
          home_access: client.user.home_access,
          pets: client.user.pets,
          relationship_status: client.user.relationship_status,
          first_name: client.user.first_name,
          last_name: client.user.last_name,
          middle_name: client.user.middle_name,
          mobile_phone: client.user.mobile_phone,
          work_phone: client.user.work_phone,
          referral_source: client.user.referral_source,
          referral_name: client.user.referral_name,
          referral_email: client.user.referral_email,

          // Additional fields
          address: client.user.address,
          city: client.user.city,
          state: client.user.state,
          country: client.user.country,
          zip_code: client.user.zip_code,
          profile_picture: client.user.profile_picture,
          account_status: client.user.account_status,
          business: client.user.business,
          bio: client.user.bio,
          children_expected: client.user.children_expected,
          service_needed: client.user.service_needed,
          health_history: client.user.health_history,
          allergies: client.user.allergies,
          due_date: client.user.due_date,
          annual_income: client.user.annual_income,
          hospital: client.user.hospital,

          // Client entity specific fields
          childrenExpected: client.childrenExpected,
          healthHistory: client.health_history,
          dueDate: client.due_date,
          babySex: client.baby_sex,
          annualIncome: client.annual_income,
          serviceSpecifics: client.service_specifics
        }
      };

      console.log('📤 Controller: Response being sent to frontend:', {
        responseKeys: Object.keys(responseData.client),
        responseKeyCount: Object.keys(responseData.client).length
      });

      // Check if important fields are missing from response
      console.log('⚠️  Controller: Missing fields in response (not sent to frontend):');
      importantFields.forEach(field => {
        if (updateData[field] !== undefined && !(field in responseData.client)) {
          console.log(`  🚨 ${field}: "${updateData[field]}" was updated but NOT in response`);
        }
      });

      console.log('🔧 PUT /clients/:id - UPDATE REQUEST COMPLETE');
      console.log('=====================================');

      res.json(responseData);
    }
    catch (error) {
      console.error('❌ Controller: Error updating client:', error);
      const err = this.handleError(error, res);
      res.status(err.status).json({ error: err.message });
    }
  }

  //
  // createActivity()
  //
  // Creates a custom activity entry for a client
  //
  // returns:
  //    Canonical: { success: true, data: ActivityDTO }
  //
  async createActivity(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const readMode = process.env.SPLIT_DB_READ_MODE;

    // Require PRIMARY mode - shadow mode disabled
    if (readMode !== 'primary') {
      res.status(501).json(ApiResponse.error('Shadow disabled', 'SHADOW_DISABLED'));
      return;
    }

    if (!id) {
      res.status(400).json(ApiResponse.error('Missing client ID', 'VALIDATION_ERROR'));
      return;
    }

    // Canonical field names: activity_type, content
    const { activity_type, content } = req.body;

    // Validate request body
    if (!activity_type || typeof activity_type !== 'string' || activity_type.trim() === '') {
      res.status(400).json(ApiResponse.error('Invalid request: activity_type is required and must be a non-empty string', 'VALIDATION_ERROR'));
      return;
    }

    if (!content || typeof content !== 'string' || content.trim() === '') {
      res.status(400).json(ApiResponse.error('Invalid request: content is required and must be a non-empty string', 'VALIDATION_ERROR'));
      return;
    }

    try {
      // Verify client exists (optional but preferred)
      const clientRepository = new SupabaseClientRepository(supabase);
      const clientExists = await clientRepository.getClientById(id);
      if (!clientExists) {
        res.status(404).json(ApiResponse.error('Client not found', 'NOT_FOUND'));
        return;
      }

      // Determine createdBy from authenticated user
      const createdBy = req.user?.id || null;

      // Create activity with explicit column selection
      const activityRepository = new SupabaseActivityRepository(supabase);
      const row = await activityRepository.createActivityCanonical(
        id,
        createdBy,
        activity_type.trim(),
        content.trim()
      );

      // Map to DTO and return canonical response
      const dto = ActivityMapper.toDTO(row);
      res.json(ApiResponse.success(dto));
    } catch (error) {
      const err = this.handleError(error, res);
      res.status(err.status).json(ApiResponse.error(err.message));
    }
  }

  //
  // getClientActivities()
  //
  // Retrieves all activities/notes for a specific client
  //
  // returns:
  //    Canonical: { success: true, data: ActivityDTO[], meta: { count } }
  //
  async getClientActivities(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const readMode = process.env.SPLIT_DB_READ_MODE;

    // Require PRIMARY mode - shadow mode disabled
    if (readMode !== 'primary') {
      res.status(501).json(ApiResponse.error('Shadow disabled', 'SHADOW_DISABLED'));
      return;
    }

    if (!id) {
      res.status(400).json(ApiResponse.error('Missing client ID', 'VALIDATION_ERROR'));
      return;
    }

    try {
      // Verify client exists (optional but preferred)
      const clientRepository = new SupabaseClientRepository(supabase);
      const clientExists = await clientRepository.getClientById(id);
      if (!clientExists) {
        res.status(404).json(ApiResponse.error('Client not found', 'NOT_FOUND'));
        return;
      }

      // Fetch activities with explicit column selection
      const activityRepository = new SupabaseActivityRepository(supabase);
      const rows = await activityRepository.getActivitiesByClientIdCanonical(id);

      // Map to DTOs
      const dtos = rows.map(row => ActivityMapper.toDTO(row));

      // Return canonical list response
      res.json(ApiResponse.list(dtos, dtos.length));
    } catch (error) {
      const err = this.handleError(error, res);
      res.status(err.status).json(ApiResponse.error(err.message));
    }
  }

  //
  // assignDoula()
  //
  // Assign a doula to a client
  //
  // returns:
  //    Assignment object
  //
  async assignDoula(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id: clientId } = req.params;
      const { doulaId } = req.body;

      if (!clientId || !doulaId) {
        res.status(400).json({ error: 'Missing clientId or doulaId' });
        return;
      }

      const assignment = await this.assignmentRepository.assignDoula(
        clientId,
        doulaId,
        req.user?.id
      );

      res.json({
        success: true,
        assignment: {
          id: assignment.id,
          doulaId: assignment.doulaId,
          clientId: assignment.clientId,
          assignedAt: assignment.assignedAt,
          status: assignment.status
        }
      });
    } catch (error) {
      const err = this.handleError(error, res);
      res.status(err.status).json({ error: err.message });
    }
  }

  //
  // unassignDoula()
  //
  // Unassign a doula from a client
  //
  // returns:
  //    Success message
  //
  async unassignDoula(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id: clientId, doulaId } = req.params;

      if (!clientId || !doulaId) {
        res.status(400).json({ error: 'Missing clientId or doulaId' });
        return;
      }

      await this.assignmentRepository.unassignDoula(clientId, doulaId);

      res.json({
        success: true,
        message: 'Doula unassigned successfully'
      });
    } catch (error) {
      const err = this.handleError(error, res);
      res.status(err.status).json({ error: err.message });
    }
  }

  //
  // getAssignedDoulas()
  //
  // Get all doulas assigned to a specific client
  //
  // returns:
  //    Array of assigned doulas with their info
  //
  async getAssignedDoulas(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id: clientId } = req.params;

      if (!clientId) {
        res.status(400).json({ error: 'Missing clientId' });
        return;
      }

      const doulas = await this.assignmentRepository.getAssignedDoulas(clientId);

      res.json({
        success: true,
        doulas: doulas
      });
    } catch (error) {
      const err = this.handleError(error, res);
      res.status(err.status).json({ error: err.message });
    }
  }

  // Helper method to handle errors
  private handleError(
    error: Error,
    res: Response
  ): { status: number, message: string } {
    console.error('Error:', error.message);

    if (error instanceof ValidationError) {
      return { status: 400, message: error.message};
    } else if (error instanceof ConflictError) {
      return { status: 409, message: error.message};
    } else if (error instanceof AuthenticationError) {
      return { status: 401, message: error.message};
    } else if (error instanceof NotFoundError) {
      return { status: 404, message: error.message};
    } else if (error instanceof AuthorizationError) {
      return { status: 403, message: error.message};
    } else {
      return { status: 500, message: error.message};
    }
  }

  // Helper for returning basic summary of a client
  private mapToClientSummary(client: Client) {
    return {
      id: client.user.id.toString(),
      firstname: client.user.firstname,
      lastname: client.user.lastname,
      serviceNeeded: client.serviceNeeded,
      requestedAt: client.requestedAt,
      updatedAt: client.updatedAt,
      status: client.status,
    };
  }
}
