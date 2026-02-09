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
// Field-name normalization (frontend → DB column names)
// ---------------------------------------------------------------------------

/**
 * Maps legacy / camelCase / aliased frontend field names to canonical
 * snake_case database column names. Entries not listed here pass through as-is.
 *
 * This covers every variant the old updateClient controller handled, including
 * camelCase (phoneNumber), short (firstname), and alternate snake names.
 */
const FIELD_ALIAS_MAP: Record<string, string> = {
  // Identity
  firstname: 'first_name',
  lastname: 'last_name',
  phoneNumber: 'phone_number',

  // Workflow / operational
  serviceNeeded: 'service_needed',
  childrenExpected: 'children_expected',
};

/**
 * Normalize a client update payload from the frontend into canonical
 * snake_case column names. Handles:
 * - camelCase aliases (phoneNumber → phone_number)
 * - Short names (firstname → first_name)
 * - Nested `user` object (user.firstname → first_name)
 * - Direct snake_case (pass-through)
 *
 * Must be called BEFORE splitClientPatch.
 */
export function normalizeClientPatch(raw: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};

  // 1) Flatten nested `user` object (frontend sometimes nests profile fields)
  const userObj = raw.user;
  if (userObj && typeof userObj === 'object' && !Array.isArray(userObj)) {
    for (const [k, v] of Object.entries(userObj)) {
      if (v === undefined) continue;
      const canonical = FIELD_ALIAS_MAP[k] ?? k;
      out[canonical] = v;
    }
  }

  // 2) Process top-level fields (overwrite nested if both present — top-level wins)
  for (const [k, v] of Object.entries(raw)) {
    if (k === 'user') continue; // already handled
    if (v === undefined) continue;
    const canonical = FIELD_ALIAS_MAP[k] ?? k;
    out[canonical] = v;
  }

  return out;
}

// ---------------------------------------------------------------------------
// Split helpers
// ---------------------------------------------------------------------------

/**
 * Split a client update payload into operational (Supabase) and PHI (broker) parts.
 * Input MUST already be normalized (canonical snake_case column names).
 *
 * @param input - Normalized flat key-value patch
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

/** Keys to strip (PHI + camelCase variants used in legacy nested objects) */
const PHI_STRIP_KEYS = new Set([
  ...PHI_FIELDS,
  'firstname',
  'lastname',
  'phoneNumber',
  'healthHistory',
  'healthNotes',
  'dueDate',
  'dateOfBirth',
  'addressLine1',
  'fullName', // derived from first_name + last_name
]);

function shouldStripKey(key: string): boolean {
  return PHI_STRIP_KEYS.has(key);
}

/**
 * Recursively strip PHI from a value (object, array, or primitive).
 * Strips at every nesting level (e.g. user.health_history, user.email).
 */
function stripPhiRecursive(value: unknown): { result: unknown; phiKeysFound: string[] } {
  const phiKeysFound: string[] = [];

  if (value === null || value === undefined) {
    return { result: value, phiKeysFound };
  }

  if (Array.isArray(value)) {
    const results: unknown[] = [];
    for (const item of value) {
      const { result, phiKeysFound: found } = stripPhiRecursive(item);
      results.push(result);
      phiKeysFound.push(...found);
    }
    return { result: results, phiKeysFound };
  }

  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    const stripped: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (shouldStripKey(k)) {
        phiKeysFound.push(k);
        continue;
      }
      const { result, phiKeysFound: found } = stripPhiRecursive(v);
      stripped[k] = result;
      phiKeysFound.push(...found);
    }
    return { result: stripped, phiKeysFound };
  }

  return { result: value, phiKeysFound };
}

/**
 * Defensive strip: remove any PHI fields from a row (recursively for nested objects).
 * Use on data coming from Supabase before returning on list/operational-only endpoints.
 */
export function stripPhiFromOperational(row: Record<string, any>): Record<string, any> {
  const { result } = stripPhiRecursive(row);
  return result as Record<string, any>;
}

/**
 * Strip PHI from a row (recursively) and return both the clean object and whether any PHI was present.
 * Use for response-level assert: if hadPhi, log security warning (never log values).
 */
export function stripPhiAndDetect(
  row: Record<string, any>
): { stripped: Record<string, any>; hadPhi: boolean; phiKeysFound: string[] } {
  const { result, phiKeysFound } = stripPhiRecursive(row);
  return {
    stripped: result as Record<string, any>,
    hadPhi: phiKeysFound.length > 0,
    phiKeysFound,
  };
}
