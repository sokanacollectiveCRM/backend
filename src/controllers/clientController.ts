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
import { ClientRepository } from '../repositories/interface/clientRepository';
import { SupabaseAssignmentRepository } from '../repositories/supabaseAssignmentRepository';
import { SupabaseActivityRepository } from '../repositories/supabaseActivityRepository';
import { PortalEligibilityService } from '../services/portalEligibilityService';
import supabase from '../supabase';
import { ClientMapper } from '../mappers/ClientMapper';
import { ActivityMapper } from '../mappers/ActivityMapper';
import { ApiResponse } from '../utils/responseBuilder';
import { canAccessSensitive } from '../utils/sensitiveAccess';
import { updateClientPhi } from '../services/phiBrokerService';
import { normalizeClientPatch, splitClientPatch, stripPhiAndDetect } from '../constants/phiFields';
import { logger } from '../common/utils/logger';
import { IS_PRODUCTION } from '../config/env';

export class ClientController {
  private clientUseCase: ClientUseCase;
  private assignmentRepository: SupabaseAssignmentRepository;
  private clientRepository: ClientRepository;
  private eligibilityService: PortalEligibilityService;

  constructor (
    clientUseCase: ClientUseCase,
    assignmentRepository: SupabaseAssignmentRepository,
    clientRepository: ClientRepository
  ) {
    this.clientUseCase = clientUseCase;
    this.assignmentRepository = assignmentRepository;
    this.clientRepository = clientRepository;
    this.eligibilityService = new PortalEligibilityService(supabase);
  }

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
      const { detailed, limit: limitParam } = req.query;
      const clients = detailed === 'true'
        ? await this.clientUseCase.getClientsDetailed(id, role)
        : await this.clientUseCase.getClientsLite(id, role);

      const limit = limitParam != null ? Math.min(Math.max(0, parseInt(String(limitParam), 10) || 0), 1000) : undefined;
      const sliced = limit != null && limit > 0 ? clients.slice(0, limit) : clients;

      const dtos = sliced.map((client) => ClientMapper.toListItemDTO(client, false));

      let safeDtos = dtos as Record<string, unknown>[];
      if (IS_PRODUCTION) {
        const allPhiKeys: string[] = [];
        safeDtos = dtos.map((d) => {
          const { stripped, hadPhi, phiKeysFound } = stripPhiAndDetect(d as Record<string, any>);
          if (hadPhi) allPhiKeys.push(...phiKeysFound);
          return stripped;
        });
        if (allPhiKeys.length > 0) {
          logger.warn(
            { phi_keys_stripped: [...new Set(allPhiKeys)], count: safeDtos.length },
            '[Client] SECURITY: PHI keys stripped from list (values not logged)'
          );
        }
      }

      logger.info({ source: 'cloud_sql', count: safeDtos.length }, '[Client] list response');
      res.json(ApiResponse.list(safeDtos, safeDtos.length));
    } catch (getError) {
      const msg = (getError instanceof Error ? getError.message : String(getError)) || '';
      if (msg.includes('does not exist') && msg.toLowerCase().includes('column')) {
        if (!res.headersSent) {
          res.status(503).json({
            error: 'phi_clients is missing columns required by the backend. Run migrations/alter_phi_clients_backend_columns.sql on your Cloud SQL database (sokana_private).',
            code: 'CLOUD_SQL_SCHEMA',
          });
        }
        return;
      }
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
  // Grab a specific client from Cloud SQL (phi_clients).
  // Operational fields always; PHI fields only when user is authorized (admin or assigned doula).
  //
  async getClientById(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json(ApiResponse.error('Missing client ID', 'VALIDATION_ERROR'));
      return;
    }

    const clientRow = await this.clientRepository.getClientById?.(id) ?? null;
    if (!clientRow) {
      res.status(404).json(ApiResponse.error('Client not found', 'NOT_FOUND'));
      return;
    }

    const dto = ClientMapper.toDetailDTO(clientRow, false);

    const { canAccess } = await canAccessSensitive(req.user, id);
    if (!canAccess) {
      logger.info({ clientId: id, source: 'cloud_sql', phi: 'skipped (unauthorized)' }, '[Client] detail response');
      res.json(ApiResponse.success(dto));
      return;
    }

    try {
      const fullClient = await this.clientRepository.findClientDetailedById(id);
      const u = fullClient.user;
      const merged: Record<string, unknown> = { ...dto };
      if (fullClient.health_history != null) merged.health_history = fullClient.health_history;
      if (fullClient.allergies != null) merged.allergies = fullClient.allergies;
      if (fullClient.due_date != null) merged.due_date = fullClient.due_date instanceof Date ? fullClient.due_date.toISOString().slice(0, 10) : fullClient.due_date;
      if (fullClient.annual_income != null) merged.annual_income = fullClient.annual_income;
      if (fullClient.baby_sex != null) merged.baby_sex = fullClient.baby_sex;
      if (u?.health_notes != null) merged.health_notes = u.health_notes;
      if (u?.baby_name != null) merged.baby_name = u.baby_name;
      if (u?.number_of_babies != null) merged.number_of_babies = u.number_of_babies;
      if (u?.race_ethnicity != null) merged.race_ethnicity = u.race_ethnicity;
      if (u?.client_age_range != null) merged.client_age_range = u.client_age_range;
      if (u?.insurance != null) merged.insurance = u.insurance;
      if (u?.pregnancy_number != null) merged.pregnancy_number = u.pregnancy_number;
      if (u?.had_previous_pregnancies != null) merged.had_previous_pregnancies = u.had_previous_pregnancies;
      if (u?.previous_pregnancies_count != null) merged.previous_pregnancies_count = u.previous_pregnancies_count;
      if (u?.living_children_count != null) merged.living_children_count = u.living_children_count;
      if (u?.past_pregnancy_experience != null) merged.past_pregnancy_experience = u.past_pregnancy_experience;
      if ((u as any)?.medications != null) merged.medications = (u as any).medications;
      if ((u as any)?.date_of_birth != null) merged.date_of_birth = typeof (u as any).date_of_birth === 'string' ? (u as any).date_of_birth : ((u as any).date_of_birth as Date)?.toISOString?.()?.slice(0, 10);
      if ((u as any)?.address_line1 != null) merged.address_line1 = (u as any).address_line1;
      logger.info({ clientId: id, source: 'cloud_sql', phi: 'included' }, '[Client] detail response');
      res.json(ApiResponse.success(merged));
    } catch {
      res.json(ApiResponse.success(dto));
    }
  } catch (error) {
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
      const updatedRow = await this.clientRepository.updateClientStatusCanonical?.(clientId, status.trim()) ?? null;

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
  // Split-write update: routes PHI fields to sokana-private (via PHI Broker)
  // and operational fields to Supabase. Returns merged fresh read.
  //
  // PHI fields (sokana-private): first_name, last_name, email, phone_number,
  //   date_of_birth, address/address_line1, due_date, health_history, allergies, etc.
  // Operational fields (Supabase): status, service_needed, portal_status, and all others.
  //
  // returns:
  //    Canonical: { success: true, data: ClientDetailDTO (merged operational + PHI) }
  //
  async updateClient(
    req: AuthRequest,
    res: Response,
  ): Promise<void> {
    const { id } = req.params;
    const updateData = req.body;
    const readMode = process.env.SPLIT_DB_READ_MODE;

    // Require PRIMARY mode
    if (readMode !== 'primary') {
      res.status(501).json(ApiResponse.error('Shadow disabled', 'SHADOW_DISABLED'));
      return;
    }

    // Validate client ID
    if (!id) {
      res.status(400).json(ApiResponse.error('Missing client ID', 'VALIDATION_ERROR'));
      return;
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      res.status(400).json(ApiResponse.error(`Invalid client ID format: ${id}`, 'VALIDATION_ERROR'));
      return;
    }

    if (!updateData || Object.keys(updateData).length === 0) {
      res.status(400).json(ApiResponse.error('No fields to update', 'VALIDATION_ERROR'));
      return;
    }

    try {
      // ── Step 0: Normalize field names (camelCase/nested → canonical snake_case) ──
      const normalized = normalizeClientPatch(updateData);

      // ── Step 1: Split payload into operational (Supabase) vs PHI (broker) ──
      const { operational, phi } = splitClientPatch(normalized);

      logger.info({
        clientId: id,
        operationalKeys: Object.keys(operational),
        phiKeyCount: Object.keys(phi).length, // don't log PHI field names in prod
      }, '[Client] update payload split');

      // ── Step 2: Authorization check (one call, reuse result) ──
      const { canAccess, assignedClientIds } = await canAccessSensitive(req.user, id);
      const requester = {
        role: req.user?.role || '',
        userId: req.user?.id || '',
        assignedClientIds,
      };

      // If PHI fields are present but user is not authorized → reject
      if (Object.keys(phi).length > 0 && !canAccess) {
        logger.warn({ clientId: id, role: req.user?.role }, '[Client] unauthorized PHI update attempt');
        res.status(403).json(ApiResponse.error('Not authorized to update PHI fields', 'FORBIDDEN'));
        return;
      }

      // ── Step 3a: Write operational fields (Supabase or Cloud SQL) ──
      let operationalResult = null;
      if (Object.keys(operational).length > 0 && this.clientRepository.updateClientOperational) {
        operationalResult = await this.clientRepository.updateClientOperational(id, operational);
        if (!operationalResult) {
          res.status(404).json(ApiResponse.error('Client not found', 'NOT_FOUND'));
          return;
        }
      }

      // ── Step 3b: Write PHI fields to sokana-private (via broker) ──
      let phiWriteResult = null;
      if (Object.keys(phi).length > 0) {
        phiWriteResult = await updateClientPhi(id, requester, phi);

        // DEBT: Write-through cache — keep Supabase identity fields in sync so list
        // endpoint shows current names. Broker stays authoritative.
        // TODO: Remove when list endpoint uses display_name/client_code instead of names.
        if (phi.first_name || phi.last_name || phi.email || phi.phone_number) {
          try {
            await this.clientRepository.updateIdentityCache?.(id, {
              first_name: phi.first_name,
              last_name: phi.last_name,
              email: phi.email,
              phone_number: phi.phone_number,
            });
          } catch {
            logger.warn({ clientId: id }, '[Client] identity cache write failed (non-blocking)');
          }
        }
      }

      // ── Step 4: Fresh read — get authoritative data from both sources ──
      const freshOperational = operationalResult ?? await this.clientRepository.getClientById?.(id) ?? null;
      if (!freshOperational) {
        res.status(404).json(ApiResponse.error('Client not found after update', 'NOT_FOUND'));
        return;
      }

      // Compute eligibility
      let isEligible = false;
      try {
        const eligibility = await this.eligibilityService.getInviteEligibility(id);
        isEligible = eligibility.eligible;
      } catch { /* swallow */ }

      // Map operational to canonical DTO
      const dto = ClientMapper.toDetailDTO(freshOperational, isEligible);

      // Merge PHI for the response (if authorized)
      let response: Record<string, any> = { ...dto };
      if (canAccess) {
        try {
          // Use broker write result if we just wrote, otherwise fresh read
          const freshPhi = phiWriteResult ?? await fetchClientPhi(id, requester);
          response = { ...dto, ...freshPhi };
        } catch {
          // PHI fetch failed — return operational only, don't block update response
          logger.warn({ clientId: id }, '[Client] PHI fetch failed after update, returning operational only');
        }
      }

      // ── Step 5: Source-of-truth instrumentation ──
      logger.info({
        clientId: id,
        sources: {
          operational: Object.keys(operational).length > 0 ? 'supabase' : 'none',
          sensitive: Object.keys(phi).length > 0 ? 'phiBroker' : 'none',
        },
        keys: {
          operational: Object.keys(freshOperational),
          sensitive: Object.keys(phiWriteResult ?? {}),
          mergedSample: Object.keys(response).slice(0, 20),
        },
      }, '[Client] update response composition');

      res.json(ApiResponse.success(response));
    } catch (error) {
      logger.error({ errorMessage: (error as Error)?.message }, '[Client] update error');
      const err = this.handleError(error as Error, res);
      if (!res.headersSent) {
        res.status(err.status).json(ApiResponse.error(err.message));
      }
    }
  }

  //
  // updateClientPhi()
  //
  // PHI-only update: routes ONLY PHI fields to sokana-private (via PHI Broker).
  // Rejects any non-PHI fields in the request body.
  //
  // Authorization: admin or assigned doula only
  //
  // PHI fields: first_name, last_name, email, phone_number, date_of_birth, due_date,
  //   address_line1, address, city, state, zip_code, country,
  //   health_history, health_notes, allergies, medications
  //
  // returns:
  //    Canonical: { success: true, message?: string }
  //
  async updateClientPhi(
    req: AuthRequest,
    res: Response,
  ): Promise<void> {
    const { id } = req.params;
    const updateData = req.body;
    const readMode = process.env.SPLIT_DB_READ_MODE;

    // Require PRIMARY mode
    if (readMode !== 'primary') {
      res.status(501).json(ApiResponse.error('Shadow disabled', 'SHADOW_DISABLED'));
      return;
    }

    // Validate client ID
    if (!id) {
      res.status(400).json(ApiResponse.error('Missing client ID', 'VALIDATION_ERROR'));
      return;
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      res.status(400).json(ApiResponse.error(`Invalid client ID format: ${id}`, 'VALIDATION_ERROR'));
      return;
    }

    if (!updateData || Object.keys(updateData).length === 0) {
      res.status(400).json(ApiResponse.error('No fields to update', 'VALIDATION_ERROR'));
      return;
    }

    try {
      // ── Step 0: Normalize field names (camelCase/nested → canonical snake_case) ──
      const normalized = normalizeClientPatch(updateData);

      // ── Step 1: Split payload and validate that ONLY PHI fields are present ──
      const { operational, phi } = splitClientPatch(normalized);

      // Reject if any operational (non-PHI) fields are present
      if (Object.keys(operational).length > 0) {
        logger.warn({
          clientId: id,
          rejectedKeys: Object.keys(operational),
        }, '[Client] PHI endpoint received non-PHI fields');
        res.status(400).json(ApiResponse.error(
          `This endpoint only accepts PHI fields. Non-PHI fields not allowed: ${Object.keys(operational).join(', ')}`,
          'VALIDATION_ERROR'
        ));
        return;
      }

      // Ensure we have PHI fields to update
      if (Object.keys(phi).length === 0) {
        res.status(400).json(ApiResponse.error('No PHI fields to update', 'VALIDATION_ERROR'));
        return;
      }

      logger.info({
        clientId: id,
        phiKeyCount: Object.keys(phi).length,
      }, '[Client] PHI-only update payload validated');

      // ── Step 2: Authorization check ──
      const { canAccess, assignedClientIds } = await canAccessSensitive(req.user, id);
      const requester = {
        role: req.user?.role || '',
        userId: req.user?.id || '',
        assignedClientIds,
      };

      if (!canAccess) {
        logger.warn({ clientId: id, role: req.user?.role }, '[Client] unauthorized PHI update attempt');
        res.status(403).json(ApiResponse.error('Not authorized to update PHI fields', 'FORBIDDEN'));
        return;
      }

      // ── Step 3: Verify client exists ──
      const clientExists = await this.clientRepository.getClientById?.(id) ?? null;
      if (!clientExists) {
        res.status(404).json(ApiResponse.error('Client not found', 'NOT_FOUND'));
        return;
      }

      // ── Step 4: Write PHI fields to sokana-private (via broker) ──
      const phiWriteResult = await updateClientPhi(id, requester, phi);

      // ── Step 5: Write-through cache — keep identity fields in sync ──
      if (phi.first_name || phi.last_name || phi.email || phi.phone_number) {
        try {
          await this.clientRepository.updateIdentityCache?.(id, {
            first_name: phi.first_name,
            last_name: phi.last_name,
            email: phi.email,
            phone_number: phi.phone_number,
          });
        } catch {
          logger.warn({ clientId: id }, '[Client] identity cache write failed (non-blocking)');
        }
      }

      // ── Step 6: Source-of-truth instrumentation ──
      logger.info({
        clientId: id,
        sources: { sensitive: 'phiBroker' },
        keys: { sensitive: Object.keys(phiWriteResult ?? {}) },
      }, '[Client] PHI-only update response composition');

      res.json(ApiResponse.success({ message: 'PHI fields updated successfully' }));
    } catch (error) {
      logger.error({ errorMessage: (error as Error)?.message }, '[Client] PHI update error');
      const err = this.handleError(error as Error, res);
      if (!res.headersSent) {
        res.status(err.status).json(ApiResponse.error(err.message));
      }
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
      const clientExists = await this.clientRepository.getClientById?.(id) ?? null;
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
      // Graceful fallback: if client_activities table is missing, return 503 (not 500)
      const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
      const isTableMissing =
        message.includes('client_activities') &&
        (message.includes('could not find') || message.includes('schema cache') ||
         message.includes('does not exist'));
      if (isTableMissing) {
        logger.warn('[Client] client_activities table missing — cannot create activity');
        res.status(503).json(ApiResponse.error('Activities feature not available — table pending migration', 'SERVICE_UNAVAILABLE'));
        return;
      }
      const err = this.handleError(error as Error, res);
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
      const clientExists = await this.clientRepository.getClientById?.(id) ?? null;
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
      // Graceful fallback: if client_activities table is missing in schema, return empty list (no 500)
      const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
      const isTableMissing =
        (message.includes('client_activities') || message.includes('failed to fetch activities')) &&
        (message.includes('could not find the table') ||
          message.includes('schema cache') ||
          message.includes("relation") ||
          message.includes('does not exist'));
      if (isTableMissing) {
        console.error('Error: Failed to fetch activities (table may be missing). Returning empty list.');
        res.json(ApiResponse.list([], 0));
        return;
      }
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
      if (ClientController.isTableMissing(error, 'assignments')) {
        res.status(503).json({ error: 'Assignments feature not available — table pending migration' });
        return;
      }
      const err = this.handleError(error as Error, res);
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
      if (ClientController.isTableMissing(error, 'assignments')) {
        res.status(503).json({ error: 'Assignments feature not available — table pending migration' });
        return;
      }
      const err = this.handleError(error as Error, res);
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
      if (ClientController.isTableMissing(error, 'assignments')) {
        res.json({ success: true, doulas: [] });
        return;
      }
      const err = this.handleError(error as Error, res);
      res.status(err.status).json({ error: err.message });
    }
  }

  /**
   * Detect if an error is due to a missing table (schema cache / relation does not exist).
   * Used for graceful degradation when tables haven't been migrated yet.
   */
  private static isTableMissing(error: unknown, tableName: string): boolean {
    const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
    return msg.includes(tableName) &&
      (msg.includes('could not find') || msg.includes('schema cache') ||
       msg.includes('does not exist') || msg.includes('relation'));
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
