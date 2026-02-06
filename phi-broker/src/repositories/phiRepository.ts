/**
 * PHI Repository - Read-only access to sensitive client data
 *
 * HIPAA COMPLIANCE:
 * - Uses explicit column SELECTs (never SELECT *)
 * - PHI values are NEVER logged
 * - Returns undefined for missing fields (to enable omission in response)
 *
 * Schema: Single phi table with columns:
 * id, first_name, last_name, email, phone, date_of_birth, address_line1,
 * due_date, health_history, allergies, medications, created_at, updated_at.
 * Lookup by client_id (FK). Table name: phi (adjust if your table differs).
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

/**
 * Fetch PHI data for a client from the phi table.
 * Date columns converted to ISO strings in SQL (date::text).
 *
 * @param clientId - The client UUID
 * @returns PhiData with only non-null fields present
 */
export async function getPhiByClientId(clientId: string): Promise<PhiData> {
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
     FROM phi
     WHERE client_id = $1
     LIMIT 1`,
    [clientId]
  );

  const row = rows[0];
  if (!row) return {};

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

  return result;
}
