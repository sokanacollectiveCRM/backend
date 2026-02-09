/**
 * PHI Repository - Access to sensitive client data in Cloud SQL (sokana-private)
 *
 * HIPAA COMPLIANCE:
 * - Uses explicit column SELECTs (never SELECT *)
 * - PHI values are NEVER logged
 * - Returns undefined for missing fields (to enable omission in response)
 * - Updates use parameterized queries and column allowlist
 *
 * Schema: Table public.phi_clients with columns:
 * client_id (FK), first_name, last_name, email, phone, date_of_birth, address_line1,
 * due_date, health_history, allergies, medications, created_at, updated_at.
 */

import { getPool } from '../db/pool';

/**
 * PHI data structure - all fields optional.
 * Matches ClientDetailDTO optional PHI shape. Fields only present when they have values.
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

export interface GetPhiResult {
  data: PhiData;
  found: boolean;
}

/**
 * Fetch PHI data for a client from the phi_clients table.
 * Date columns converted to ISO strings in SQL (date::text).
 *
 * @param clientId - The client UUID
 * @returns GetPhiResult with data and found flag (found false when 0 rows)
 */
export async function getPhiByClientId(clientId: string): Promise<GetPhiResult> {
  const pool = getPool();

  const { rows } = await pool.query<{
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone_number: string | null;
    date_of_birth: string | null;
    address_line1: string | null;
    due_date: string | null;
    health_history: string | null;
    allergies: string | null;
    medications: string | null;
  }>(
    `SELECT
      first_name,
      last_name,
      email,
      phone AS phone_number,
      date_of_birth::text AS date_of_birth,
      address_line1,
      due_date::text AS due_date,
      health_history,
      allergies,
      medications
     FROM phi_clients
     WHERE client_id = $1
     LIMIT 1`,
    [clientId]
  );

  const row = rows[0];
  if (!row) {
    return { data: {}, found: false };
  }

  const result: PhiData = {};
  if (row.first_name !== null) result.first_name = row.first_name;
  if (row.last_name !== null) result.last_name = row.last_name;
  if (row.email !== null) result.email = row.email;
  if (row.phone_number !== null) result.phone_number = row.phone_number;
  if (row.date_of_birth !== null) result.date_of_birth = row.date_of_birth;
  if (row.address_line1 !== null) result.address_line1 = row.address_line1;
  if (row.due_date !== null) result.due_date = row.due_date;
  if (row.health_history !== null) result.health_history = row.health_history;
  if (row.allergies !== null) result.allergies = row.allergies;
  if (row.medications !== null) result.medications = row.medications;

  return { data: result, found: true };
}

// ---------------------------------------------------------------------------
// UPDATE
// ---------------------------------------------------------------------------

/**
 * Maps API field names → phi_clients column names.
 * Only keys present here are allowed in UPDATE statements.
 * Note: API uses "phone_number" but the DB column is "phone".
 */
const PHI_WRITE_COLUMN_MAP: Record<string, string> = {
  first_name: 'first_name',
  last_name: 'last_name',
  email: 'email',
  phone_number: 'phone',           // API name → DB column name
  date_of_birth: 'date_of_birth',
  address_line1: 'address_line1',
  due_date: 'due_date',
  health_history: 'health_history',
  allergies: 'allergies',
  medications: 'medications',
};

/** Allowed API-level field names for PHI writes. */
export const ALLOWED_PHI_WRITE_KEYS = new Set(Object.keys(PHI_WRITE_COLUMN_MAP));

export interface UpdatePhiResult {
  updated: boolean;
  updated_keys: string[];
}

/**
 * Update PHI fields for a client in the phi_clients table.
 *
 * - Only columns in PHI_WRITE_COLUMN_MAP are written; unknown keys are silently skipped.
 * - Uses parameterized queries ($1, $2, …) — no interpolation.
 * - Sets updated_at = NOW() on every write.
 *
 * @param clientId - The client UUID (matches phi_clients.client_id)
 * @param fields   - Object with API field names as keys (e.g. { first_name: "X" })
 * @returns { updated: true/false, updated_keys: string[] }
 */
export async function updatePhiByClientId(
  clientId: string,
  fields: Record<string, any>
): Promise<UpdatePhiResult> {
  const pool = getPool();

  // Map API field names → DB column names, dropping unknown or undefined keys
  const entries: Array<{ apiKey: string; dbCol: string; value: any }> = [];
  for (const [apiKey, value] of Object.entries(fields)) {
    const dbCol = PHI_WRITE_COLUMN_MAP[apiKey];
    if (dbCol && value !== undefined) {
      entries.push({ apiKey, dbCol, value });
    }
  }

  if (entries.length === 0) {
    return { updated: false, updated_keys: [] };
  }

  // Build parameterized SET clause: $1 = clientId, $2.. = field values
  const setClauses = entries.map((e, i) => `"${e.dbCol}" = $${i + 2}`);
  const sql = `UPDATE phi_clients SET ${setClauses.join(', ')}, updated_at = NOW() WHERE client_id = $1`;
  const params = [clientId, ...entries.map(e => e.value)];

  const result = await pool.query(sql, params);

  return {
    updated: (result.rowCount ?? 0) > 0,
    updated_keys: entries.map(e => e.apiKey),
  };
}
