/**
 * PHI Repository - Read-only access to sensitive client data
 * 
 * HIPAA COMPLIANCE:
 * - Uses explicit column SELECTs (never SELECT *)
 * - PHI values are NEVER logged
 * - Returns undefined for missing fields (to enable omission in response)
 * 
 * Schema:
 * - sensitive_clients (client_id uuid pk, due_date, pregnancy_number, etc.)
 * - sensitive_health_history (client_id uuid fk, health_history, allergies, health_notes)
 * - sensitive_demographics (client_id uuid fk, race_ethnicity, client_age_range, annual_income, insurance)
 */

import { getPool } from '../db/pool';

/**
 * PHI data structure - all fields optional.
 * Fields are only present if they have values.
 */
export interface PhiData {
  due_date?: string;
  health_history?: string;
  health_notes?: string;
  allergies?: string;
  pregnancy_number?: number;
  had_previous_pregnancies?: boolean;
  previous_pregnancies_count?: number;
  living_children_count?: number;
  past_pregnancy_experience?: string;
  baby_sex?: string;
  baby_name?: string;
  number_of_babies?: number;
  race_ethnicity?: string;
  client_age_range?: string;
  annual_income?: string;
  insurance?: string;
}

/**
 * Fetch all PHI data for a client.
 * Executes parallel queries to three tables and merges results.
 * 
 * @param clientId - The client UUID
 * @returns PhiData with only non-null fields present
 */
export async function getPhiByClientId(clientId: string): Promise<PhiData> {
  const pool = getPool();

  // Execute queries in parallel
  const [clientResult, healthResult, demographicsResult] = await Promise.all([
    // Query 1: sensitive_clients table
    pool.query<{
      due_date: string | null;
      pregnancy_number: number | null;
      had_previous_pregnancies: boolean | null;
      previous_pregnancies_count: number | null;
      living_children_count: number | null;
      past_pregnancy_experience: string | null;
      baby_sex: string | null;
      baby_name: string | null;
      number_of_babies: number | null;
    }>(
      `SELECT 
        due_date,
        pregnancy_number,
        had_previous_pregnancies,
        previous_pregnancies_count,
        living_children_count,
        past_pregnancy_experience,
        baby_sex,
        baby_name,
        number_of_babies
       FROM sensitive_clients
       WHERE client_id = $1
       LIMIT 1`,
      [clientId]
    ),

    // Query 2: sensitive_health_history table
    pool.query<{
      health_history: string | null;
      allergies: string | null;
      health_notes: string | null;
    }>(
      `SELECT health_history, allergies, health_notes
       FROM sensitive_health_history
       WHERE client_id = $1
       LIMIT 1`,
      [clientId]
    ),

    // Query 3: sensitive_demographics table
    pool.query<{
      race_ethnicity: string | null;
      client_age_range: string | null;
      annual_income: string | null;
      insurance: string | null;
    }>(
      `SELECT race_ethnicity, client_age_range, annual_income, insurance
       FROM sensitive_demographics
       WHERE client_id = $1
       LIMIT 1`,
      [clientId]
    ),
  ]);

  // Build result object, only including non-null values
  const result: PhiData = {};

  // From sensitive_clients
  const clientRow = clientResult.rows[0];
  if (clientRow) {
    if (clientRow.due_date !== null) result.due_date = clientRow.due_date;
    if (clientRow.pregnancy_number !== null) result.pregnancy_number = clientRow.pregnancy_number;
    if (clientRow.had_previous_pregnancies !== null) result.had_previous_pregnancies = clientRow.had_previous_pregnancies;
    if (clientRow.previous_pregnancies_count !== null) result.previous_pregnancies_count = clientRow.previous_pregnancies_count;
    if (clientRow.living_children_count !== null) result.living_children_count = clientRow.living_children_count;
    if (clientRow.past_pregnancy_experience !== null) result.past_pregnancy_experience = clientRow.past_pregnancy_experience;
    if (clientRow.baby_sex !== null) result.baby_sex = clientRow.baby_sex;
    if (clientRow.baby_name !== null) result.baby_name = clientRow.baby_name;
    if (clientRow.number_of_babies !== null) result.number_of_babies = clientRow.number_of_babies;
  }

  // From sensitive_health_history
  const healthRow = healthResult.rows[0];
  if (healthRow) {
    if (healthRow.health_history !== null) result.health_history = healthRow.health_history;
    if (healthRow.allergies !== null) result.allergies = healthRow.allergies;
    if (healthRow.health_notes !== null) result.health_notes = healthRow.health_notes;
  }

  // From sensitive_demographics
  const demographicsRow = demographicsResult.rows[0];
  if (demographicsRow) {
    if (demographicsRow.race_ethnicity !== null) result.race_ethnicity = demographicsRow.race_ethnicity;
    if (demographicsRow.client_age_range !== null) result.client_age_range = demographicsRow.client_age_range;
    if (demographicsRow.annual_income !== null) result.annual_income = demographicsRow.annual_income;
    if (demographicsRow.insurance !== null) result.insurance = demographicsRow.insurance;
  }

  return result;
}
