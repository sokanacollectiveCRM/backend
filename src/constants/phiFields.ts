/**
 * PHI Field Ownership Constants
 *
 * sokana-private (Cloud SQL via PHI Broker) is the source of truth for PHI.
 * Supabase is the source of truth for operational/workflow fields.
 *
 * Used for:
 * - Split writes: route updates to the correct datastore
 * - Defensive stripping: prevent PHI leaking on operational-only endpoints
 * - Source-of-truth instrumentation logging
 */

// ---------------------------------------------------------------------------
// PHI fields — owned by sokana-private
// ---------------------------------------------------------------------------

/**
 * Fields owned by sokana-private (PHI database).
 * Updates to these MUST go through the PHI Broker — never write directly to Supabase.
 *
 * Matches PHI Broker PhiData interface + user's ownership spec:
 *   Identity:  first_name, last_name, email, phone_number
 *   Dates:     date_of_birth, due_date
 *   Address:   address_line1, address (Supabase alias)
 *   Clinical:  health_history, health_notes, allergies, medications
 */
export const PHI_FIELDS = new Set([
  // Identity
  'first_name',
  'last_name',
  'email',
  'phone_number',

  // Dates
  'date_of_birth',
  'due_date',

  // Address — broker uses address_line1; Supabase uses address
  'address_line1',
  'address',
  'city',
  'state',
  'zip_code',
  'country',

  // Clinical / health
  'health_history',
  'health_notes',
  'allergies',
  'medications',
]);

// ---------------------------------------------------------------------------
// Operational columns allowed for Supabase update
// ---------------------------------------------------------------------------

/**
 * Columns that may be written to Supabase's client_info table.
 * PHI fields are intentionally excluded — they go through the PHI Broker.
 */
export const OPERATIONAL_UPDATE_COLUMNS = new Set([
  'status',
  'service_needed',
  'portal_status',
  'children_expected',
  'pronouns',
  'pronouns_other',
  'preferred_contact_method',
  'preferred_name',
  'payment_method',
  'home_type',
  'services_interested',
  'service_specifics',
  'service_support_details',
  'baby_sex',
  'baby_name',
  'birth_hospital',
  'birth_location',
  'number_of_babies',
  'provider_type',
  'pregnancy_number',
  'had_previous_pregnancies',
  'previous_pregnancies_count',
  'living_children_count',
  'past_pregnancy_experience',
  'race_ethnicity',
  'primary_language',
  'client_age_range',
  'insurance',
  'demographics_multi',
  'home_phone',
  'home_access',
  'pets',
  'relationship_status',
  'middle_name',
  'mobile_phone',
  'work_phone',
  'referral_source',
  'referral_name',
  'referral_email',
  'profile_picture',
  'account_status',
  'business',
  'bio',
  'annual_income',
  'hospital',
  'role',
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Split a client update payload into operational (Supabase) and PHI (broker) parts.
 *
 * @param input - Flat key-value patch from the request body
 * @returns { operational, phi } — two disjoint objects
 */
export function splitClientPatch(input: Record<string, any>): {
  operational: Record<string, any>;
  phi: Record<string, any>;
} {
  const operational: Record<string, any> = {};
  const phi: Record<string, any> = {};

  for (const [k, v] of Object.entries(input)) {
    if (v === undefined) continue;
    if (PHI_FIELDS.has(k)) {
      phi[k] = v;
    } else {
      operational[k] = v;
    }
  }

  return { operational, phi };
}

/**
 * Defensive strip: remove any PHI fields from a row.
 * Use on data coming from Supabase before returning on list/operational-only endpoints.
 */
export function stripPhiFromOperational(row: Record<string, any>): Record<string, any> {
  const clone = { ...row };
  for (const k of PHI_FIELDS) {
    delete clone[k];
  }
  return clone;
}
