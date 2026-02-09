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
import { fetchClientPhi, updateClientPhi } from '../services/phiBrokerService';
import { normalizeClientPatch, splitClientPatch, stripPhiAndDetect } from '../constants/phiFields';
import { logger } from '../common/utils/logger';
import { IS_PRODUCTION } from '../config/env';

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

        // Production: strip PHI by default; enrich for admin and assigned doulas only
        let safeDtos = dtos as Record<string, any>[];
        if (IS_PRODUCTION) {
          // Strip first (removes any PHI that may have come from entity)
          const allPhiKeys: string[] = [];
          safeDtos = dtos.map((d) => {
            const { stripped, hadPhi, phiKeysFound } = stripPhiAndDetect(d as Record<string, any>);
            if (hadPhi) allPhiKeys.push(...phiKeysFound);
            return stripped;
          });
          if (allPhiKeys.length > 0) {
            const uniqueKeys = [...new Set(allPhiKeys)];
            logger.warn(
              { phi_keys_stripped: uniqueKeys, count: dtos.length },
              '[Client] SECURITY: PHI keys found in list response; stripped (values not logged)'
            );
          }

          // Enrich with PHI for admin and assigned doulas (first_name, last_name, email)
          const { canAccessSensitive } = await import('../utils/sensitiveAccess');
          const { fetchClientPhi } = await import('../services/phiBrokerService');
          const firstId = safeDtos[0]?.id as string | undefined;
          const accessCheck = await canAccessSensitive(req.user!, firstId || '');
          const requester = {
            role: req.user?.role || '',
            userId: req.user?.id || '',
            assignedClientIds: accessCheck.assignedClientIds,
          };
          const canEnrich =
            req.user?.role === 'admin' ||
            (req.user?.role === 'doula' && requester.assignedClientIds.length > 0);
          if (canEnrich) {
            const enriched = await Promise.all(
              safeDtos.map(async (dto) => {
                const clientId = dto.id as string;
                const access = await canAccessSensitive(req.user!, clientId);
                if (!access.canAccess) return dto;
                try {
                  const phi = await fetchClientPhi(clientId, {
                    ...requester,
                    assignedClientIds: access.assignedClientIds,
                  });
                  if (phi.first_name || phi.last_name || phi.email) {
                    return {
                      ...dto,
                      first_name: phi.first_name ?? dto.first_name,
                      last_name: phi.last_name ?? dto.last_name,
                      email: phi.email ?? dto.email,
                    };
                  }
                } catch (e) {
                  logger.warn({ clientId, err: (e as Error)?.message }, '[Client] PHI enrichment skipped for list item');
                }
                return dto;
              })
            );
            safeDtos = enriched;
          }
        }

        logger.info({
          sources: { operational: 'supabase', sensitive: IS_PRODUCTION ? 'phiBroker (when authorized)' : 'none' },
          keys: {
            operational: safeDtos.length > 0 ? Object.keys(safeDtos[0]) : [],
          },
          count: safeDtos.length,
        }, '[Client] list response composition');

        res.json(ApiResponse.list(safeDtos, safeDtos.length));
        return;
      }

      // Legacy response format (raw array) for non-primary modes
      // Note: Avoid logging client data - HIPAA compliance

      // Compute eligibility for each client and add to response
      let clientsWithEligibility = await Promise.all(
        clients.map(async (client) => {
          const clientJson = client.toJson() as any;
          try {
            const eligibility = await this.eligibilityService.getInviteEligibility(client.id);
            clientJson.is_eligible = eligibility.eligible;
          } catch (error) {
            // If eligibility check fails, default to false
            logger.error({ err: error, clientId: client.id }, 'Error checking eligibility for client');
            clientJson.is_eligible = false;
          }
          return clientJson;
        })
      );

      // Production: strip any PHI from list response
      if (IS_PRODUCTION) {
        const allPhiKeys: string[] = [];
        clientsWithEligibility = clientsWithEligibility.map((row) => {
          const { stripped, hadPhi, phiKeysFound } = stripPhiAndDetect(row);
          if (hadPhi) allPhiKeys.push(...phiKeysFound);
          return stripped;
        });
        if (allPhiKeys.length > 0) {
          const uniqueKeys = [...new Set(allPhiKeys)];
          logger.warn(
            { phi_keys_stripped: uniqueKeys, count: clientsWithEligibility.length },
            '[Client] SECURITY: PHI keys found in list response; stripped (values not logged)'
          );
        }
      }

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

    if (!canAccess) {
      // Source-of-truth instrumentation (operational only)
      logger.info({
        clientId: id,
        sources: { operational: 'supabase', sensitive: 'skipped (unauthorized)' },
        keys: { operational: Object.keys(dto) },
      }, '[Client] detail response composition');

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

      const merged = { ...dto, ...phiData };

      // Source-of-truth instrumentation (merged)
      logger.info({
        clientId: id,
        sources: { operational: 'supabase', sensitive: 'phiBroker' },
        keys: {
          operational: Object.keys(dto),
          sensitive: Object.keys(phiData || {}),
          mergedSample: Object.keys(merged).slice(0, 20),
        },
      }, '[Client] detail response composition');

      res.json(ApiResponse.success(merged));
      return;
    } catch (e) {
      logger.error({
        clientId: id,
        errorName: (e as Error)?.name,
        errorMessage: (e as Error)?.message,
      }, '[Client] PHI broker error');
      res.status(502).json(ApiResponse.error('Upstream PHI service unavailable', 'PHI_BROKER_ERROR'));
      return;
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

      const clientRepository = new SupabaseClientRepository(supabase);

      // ── Step 3a: Write operational fields to Supabase ──
      let operationalResult = null;
      if (Object.keys(operational).length > 0) {
        operationalResult = await clientRepository.updateClientOperational(id, operational);
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
            await clientRepository.updateIdentityCache(id, {
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
      const freshOperational = operationalResult ?? await clientRepository.getClientById(id);
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
