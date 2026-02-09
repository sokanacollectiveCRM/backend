/**
 * PHI Controller - Handles PHI data requests with authorization gating
 *
 * HIPAA COMPLIANCE:
 * - PHI values are NEVER logged
 * - Only metadata is logged (role, user_id, client_id, authorized, latency)
 * - Unauthorized requests return empty data (not error)
 * - Error logs: error.name, message, pg code/constraint/table/column only — no body, no PHI
 */

import { Request, Response } from 'express';
import { ResponseBuilder } from '../utils/responseBuilder';
import { getPhiByClientId } from '../repositories/phiRepository';

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
 * HIPAA-safe error log: error.name, message, optional pg fields; client_id, user_id, role, authorized, latency_ms, request_id.
 * Never log request body or PHI values.
 */
function logPhiError(
  requestId: string | undefined,
  error: unknown,
  meta: { client_id?: string; user_id?: string; role?: string; authorized?: boolean; latency_ms: number }
): void {
  const err = error instanceof Error ? error : new Error(String(error));
  const pg = err as { code?: string; constraint?: string; table?: string; column?: string };
  console.error('[PHI] Error processing request', {
    request_id: requestId,
    error_name: err.name,
    error_message: err.message,
    ...(pg.code && { pg_code: pg.code }),
    ...(pg.constraint && { pg_constraint: pg.constraint }),
    ...(pg.table && { pg_table: pg.table }),
    ...(pg.column && { pg_column: pg.column }),
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
      client_id,
      user_id: requester.user_id,
      role: requester.role,
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
      client_id,
      user_id: requester.user_id,
      authorized: true,
      field_count: Object.keys(result.data).length,
      latency_ms: totalLatency,
    });

    res.json(ResponseBuilder.success(result.data));
  } catch (error) {
    const latency = Date.now() - startTime;
    logPhiError(requestId, error, {
      client_id: (req.body as PhiRequest)?.client_id,
      user_id: (req.body as PhiRequest)?.requester?.user_id,
      role: (req.body as PhiRequest)?.requester?.role,
      authorized: (req.body as PhiRequest) ? isAuthorized((req.body as PhiRequest).requester, (req.body as PhiRequest).client_id) : undefined,
      latency_ms: latency,
    });
    if (!res.headersSent) {
      res.status(500).json(ResponseBuilder.error('Internal server error', 'INTERNAL_ERROR', requestId));
    }
  }
}
