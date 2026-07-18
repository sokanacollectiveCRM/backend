/**
 * PHI Controller - Handles PHI data requests with authorization gating
 *
 * HIPAA COMPLIANCE:
 * - PHI values are NEVER logged
 * - Only correlation, outcome, count, and latency metadata is logged
 * - Unauthorized requests return empty data (not error)
 * - Error logs use fixed internal categories and never serialize errors
 */

import { Request, Response } from 'express';
import { ResponseBuilder } from '../utils/responseBuilder';
import { getPhiByClientId, updatePhiByClientId, ALLOWED_PHI_WRITE_KEYS } from '../repositories/phiRepository';

/** UUID v4 regex (RFC 4122). */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUUID(s: string): boolean {
  return typeof s === 'string' && UUID_REGEX.test(s.trim());
}

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

type RequestWithId = Request & { requestId?: string };

/**
 * Check if requester is authorized to access PHI for the given client.
 *
 * Rules:
 * - admin: always authorized
 * - doula: authorized only if client_id is in assigned_client_ids
 * - other: unauthorized
 */
function isAuthorized(requester: PhiRequest['requester'], clientId: string): boolean {
  if (requester.role === 'admin') return true;
  if (requester.role === 'doula') {
    const assignedIds = requester.assigned_client_ids || [];
    return assignedIds.includes(clientId);
  }
  return false;
}

/**
 * HIPAA-safe error log: fixed category, correlation ID, and latency only.
 */
function logPhiError(
  requestId: string | undefined,
  error: unknown,
  meta: { latency_ms: number }
): void {
  void error;
  console.error('[PHI] Error processing request', {
    request_id: requestId,
    error_code: 'PHI_OPERATION_FAILED',
    retryable: false,
    ...meta,
  });
}

/**
 * POST /v1/phi/client
 *
 * Fetches PHI data for a client if requester is authorized.
 * Returns: 401 (auth — middleware), 400 (invalid/missing body or client_id), 404 (no PHI row), 200 (success).
 */
export async function getClientPhi(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  const reqWithId = req as RequestWithId;
  const requestId = reqWithId.requestId;

  try {
    const body = req.body as PhiRequest | undefined;

    if (body == null || typeof body !== 'object') {
      res.status(400).json(ResponseBuilder.error('Missing or invalid request body', 'VALIDATION_ERROR', requestId));
      return;
    }
    if (!body.client_id || typeof body.client_id !== 'string') {
      res.status(400).json(ResponseBuilder.error('Missing or invalid client_id', 'VALIDATION_ERROR', requestId));
      return;
    }
    if (!isValidUUID(body.client_id)) {
      res.status(400).json(ResponseBuilder.error('Invalid client_id format (must be UUID)', 'VALIDATION_ERROR', requestId));
      return;
    }
    if (!body.requester || !body.requester.role || !body.requester.user_id) {
      res.status(400).json(ResponseBuilder.error('Missing or invalid requester', 'VALIDATION_ERROR', requestId));
      return;
    }

    const { client_id, requester } = body;
    const authorized = isAuthorized(requester, client_id);

    console.log('[PHI] Request', {
      request_id: requestId,
      authorized,
      latency_ms: Date.now() - startTime,
    });

    if (!authorized) {
      res.json(ResponseBuilder.success({}));
      return;
    }

    const result = await getPhiByClientId(client_id);

    if (!result.found) {
      res.status(404).json(ResponseBuilder.error('No PHI found for client', 'NOT_FOUND', requestId));
      return;
    }

    const totalLatency = Date.now() - startTime;
    console.log('[PHI] Response', {
      request_id: requestId,
      authorized: true,
      field_count: Object.keys(result.data).length,
      latency_ms: totalLatency,
    });

    res.json(ResponseBuilder.success(result.data));
  } catch (error) {
    const latency = Date.now() - startTime;
    logPhiError(requestId, error, {
      latency_ms: latency,
    });
    if (!res.headersSent) {
      res.status(500).json(ResponseBuilder.error('Internal server error', 'INTERNAL_ERROR', requestId));
    }
  }
}

// ---------------------------------------------------------------------------
// UPDATE PHI
// ---------------------------------------------------------------------------

/**
 * Request body structure for PHI update requests.
 */
interface UpdatePhiRequestBody {
  client_id: string;
  requester: {
    role: 'admin' | 'doula' | string;
    user_id: string;
    assigned_client_ids?: string[];
  };
  fields: Record<string, any>;
}

/**
 * POST /v1/phi/client/update
 *
 * Updates PHI fields for a client if requester is authorized.
 *
 * Authorization:
 * - admin: always authorized
 * - all other roles: denied (stricter than read — updates are admin-only)
 *
 * Returns: 401 (HMAC), 400 (validation), 403 (not admin), 200 (success).
 *
 * HIPAA: Field keys are logged but values are NEVER logged.
 */
export async function updateClientPhi(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  const reqWithId = req as RequestWithId;
  const requestId = reqWithId.requestId;

  try {
    const body = req.body as UpdatePhiRequestBody | undefined;

    // ── Validate body structure ──
    if (body == null || typeof body !== 'object') {
      res.status(400).json(ResponseBuilder.error('Missing or invalid request body', 'VALIDATION_ERROR', requestId));
      return;
    }
    if (!body.client_id || typeof body.client_id !== 'string') {
      res.status(400).json(ResponseBuilder.error('Missing or invalid client_id', 'VALIDATION_ERROR', requestId));
      return;
    }
    if (!isValidUUID(body.client_id)) {
      res.status(400).json(ResponseBuilder.error('Invalid client_id format (must be UUID)', 'VALIDATION_ERROR', requestId));
      return;
    }
    if (!body.requester || !body.requester.role || !body.requester.user_id) {
      res.status(400).json(ResponseBuilder.error('Missing or invalid requester', 'VALIDATION_ERROR', requestId));
      return;
    }
    if (!body.fields || typeof body.fields !== 'object' || Object.keys(body.fields).length === 0) {
      res.status(400).json(ResponseBuilder.error('Missing or empty fields object', 'VALIDATION_ERROR', requestId));
      return;
    }

    // ── Allowlist field keys ──
    for (const key of Object.keys(body.fields)) {
      if (!ALLOWED_PHI_WRITE_KEYS.has(key)) {
        res.status(400).json(ResponseBuilder.error(`Field not allowed: ${key}`, 'VALIDATION_ERROR', requestId));
        return;
      }
    }

    const { client_id, requester, fields } = body;

    // ── Authorization: admin-only for PHI writes ──
    if (requester.role !== 'admin') {
      console.log('[PHI] Update denied (not admin)', {
        request_id: requestId,
        latency_ms: Date.now() - startTime,
      });
      res.status(403).json(ResponseBuilder.error('Not authorized to update PHI', 'FORBIDDEN', requestId));
      return;
    }

    // HIPAA: log count only; field names and values are not logged.
    console.log('[PHI] Update request', {
      request_id: requestId,
      field_count: Object.keys(fields).length,
    });

    // ── Perform update ──
    const result = await updatePhiByClientId(client_id, fields);

    const totalLatency = Date.now() - startTime;
    console.log('[PHI] Update response', {
      request_id: requestId,
      updated: result.updated,
      updated_count: result.updated_keys.length,
      latency_ms: totalLatency,
    });

    res.json(ResponseBuilder.success(result));
  } catch (error) {
    const latency = Date.now() - startTime;
    logPhiError(requestId, error, {
      latency_ms: latency,
    });
    if (!res.headersSent) {
      res.status(500).json(ResponseBuilder.error('Internal server error', 'INTERNAL_ERROR', requestId));
    }
  }
}
