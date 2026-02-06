/**
 * PHI Controller - Handles PHI data requests with authorization gating
 * 
 * HIPAA COMPLIANCE:
 * - PHI values are NEVER logged
 * - Only metadata is logged (role, user_id, client_id, authorized, latency)
 * - Unauthorized requests return empty data (not error)
 */

import { Request, Response } from 'express';
import { ResponseBuilder } from '../utils/responseBuilder';
import { getPhiByClientId, PhiData } from '../repositories/phiRepository';

/**
 * Request body structure for PHI requests.
 */
interface PhiRequest {
  client_id: string;
  requester: {
    role: 'admin' | 'doula' | string;
    user_id: string;
    assigned_client_ids?: string[];
  };
}

/**
 * Check if requester is authorized to access PHI for the given client.
 * 
 * Rules:
 * - admin: always authorized
 * - doula: authorized only if client_id is in assigned_client_ids
 * - other: unauthorized
 */
function isAuthorized(requester: PhiRequest['requester'], clientId: string): boolean {
  // Admin always authorized
  if (requester.role === 'admin') {
    return true;
  }

  // Doula: check if assigned to client
  if (requester.role === 'doula') {
    const assignedIds = requester.assigned_client_ids || [];
    return assignedIds.includes(clientId);
  }

  // All other roles: unauthorized
  return false;
}

/**
 * POST /v1/phi/client
 * 
 * Fetches PHI data for a client if requester is authorized.
 * Returns empty data object if unauthorized (not an error).
 */
export async function getClientPhi(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  
  try {
    const body = req.body as PhiRequest;

    // Validate request body
    if (!body.client_id || typeof body.client_id !== 'string') {
      res.status(400).json(ResponseBuilder.error('Missing or invalid client_id', 'VALIDATION_ERROR'));
      return;
    }

    if (!body.requester || !body.requester.role || !body.requester.user_id) {
      res.status(400).json(ResponseBuilder.error('Missing or invalid requester', 'VALIDATION_ERROR'));
      return;
    }

    const { client_id, requester } = body;

    // Check authorization
    const authorized = isAuthorized(requester, client_id);

    // Log metadata only (NEVER log PHI)
    const latency = Date.now() - startTime;
    console.log('[PHI] Request', {
      client_id,
      user_id: requester.user_id,
      role: requester.role,
      authorized,
      latency_ms: latency,
    });

    // If not authorized, return empty data (not error)
    if (!authorized) {
      res.json(ResponseBuilder.success({}));
      return;
    }

    // Fetch PHI data
    const phiData = await getPhiByClientId(client_id);

    // Log completion (no PHI values)
    const totalLatency = Date.now() - startTime;
    console.log('[PHI] Response', {
      client_id,
      user_id: requester.user_id,
      authorized: true,
      field_count: Object.keys(phiData).length,
      latency_ms: totalLatency,
    });

    res.json(ResponseBuilder.success(phiData));
  } catch (error) {
    const latency = Date.now() - startTime;
    // Log error without PHI details
    console.error('[PHI] Error processing request', { latency_ms: latency });
    res.status(500).json(ResponseBuilder.error('Internal server error', 'INTERNAL_ERROR'));
  }
}
