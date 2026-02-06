/**
 * PHI Broker Service - Client for Vercel backend to fetch PHI data
 * 
 * HIPAA COMPLIANCE:
 * - PHI response values are NEVER logged
 * - Uses HMAC signature for service-to-service auth
 * - Throws typed error on broker failure (controller returns 502)
 * 
 * Environment Variables:
 * - PHI_BROKER_URL: Base URL of the PHI Broker service
 * - PHI_BROKER_SHARED_SECRET: HMAC shared secret
 */

import { createHmac } from 'crypto';

/**
 * Error thrown when PHI Broker is unavailable or returns an error.
 */
export class PhiBrokerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PhiBrokerError';
  }
}

/**
 * Requester information for authorization.
 */
export interface PhiRequester {
  role: string;
  userId: string;
  assignedClientIds?: string[];
}

/**
 * PHI data returned from the broker.
 * All fields are optional - only present when data exists and user is authorized.
 * Matches phi-broker PhiData shape (snake_case, phone_number alias).
 */
export interface PhiData {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone_number?: string;
  date_of_birth?: string;
  address_line1?: string;
  due_date?: string;
  health_history?: string;
  allergies?: string;
  medications?: string;
}

/**
 * Create HMAC signature for broker request.
 */
function signRequest(timestamp: string, body: string, secret: string): string {
  const payload = `${timestamp}.${body}`;
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Fetch PHI data for a client from the PHI Broker service.
 * 
 * @param clientId - The client UUID
 * @param requester - Information about the requester (role, userId, assignedClientIds)
 * @returns PHI data object (empty if unauthorized or no data)
 * @throws PhiBrokerError if broker is unavailable or returns an error
 * 
 * HIPAA: PHI values are NEVER logged
 */
export async function fetchClientPhi(
  clientId: string,
  requester: PhiRequester
): Promise<PhiData> {
  const brokerUrl = process.env.PHI_BROKER_URL;
  const sharedSecret = process.env.PHI_BROKER_SHARED_SECRET;

  // If broker not configured, return empty (PHI feature disabled)
  if (!brokerUrl || !sharedSecret) {
    console.log('[PhiBroker] Not configured, returning empty PHI');
    return {};
  }

  // Build request body
  const requestBody = JSON.stringify({
    client_id: clientId,
    requester: {
      role: requester.role,
      user_id: requester.userId,
      assigned_client_ids: requester.assignedClientIds || [],
    },
  });

  // Create timestamp and signature
  const timestamp = Date.now().toString();
  const signature = signRequest(timestamp, requestBody, sharedSecret);

  try {
    const response = await fetch(`${brokerUrl}/v1/phi/client`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sokana-Timestamp': timestamp,
        'X-Sokana-Signature': signature,
      },
      body: requestBody,
    });

    // Check for non-2xx response
    if (!response.ok) {
      // Log metadata only
      console.error('[PhiBroker] Request failed', {
        status: response.status,
        clientId,
        userId: requester.userId,
      });
      throw new PhiBrokerError(`Broker returned ${response.status}`);
    }

    const result = await response.json() as { success: boolean; data?: PhiData; error?: string };

    if (!result.success) {
      console.error('[PhiBroker] Broker returned error', {
        clientId,
        userId: requester.userId,
        // Do NOT log error message which might contain PHI
      });
      throw new PhiBrokerError('Broker returned error response');
    }

    // Log success metadata only (NEVER log PHI values)
    console.log('[PhiBroker] Request successful', {
      clientId,
      userId: requester.userId,
      fieldCount: result.data ? Object.keys(result.data).length : 0,
    });

    return result.data || {};
  } catch (error) {
    // If it's already our error, rethrow
    if (error instanceof PhiBrokerError) {
      throw error;
    }

    // Network or parsing error
    console.error('[PhiBroker] Network error', {
      clientId,
      userId: requester.userId,
      errorType: error instanceof Error ? error.name : 'unknown',
    });
    throw new PhiBrokerError('Failed to connect to PHI Broker');
  }
}
