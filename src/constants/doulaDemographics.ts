/**
 * Allowed race/ethnicity multi-select values for doula profile (Cloud SQL + API).
 * Keep in sync with frontend `doulaDemographics` constants.
 */
export const DOULA_RACE_ETHNICITY_ALLOWED = [
  'black_african_american',
  'african',
  'afro_caribbean',
  'afro_latinx',
  'hispanic_latino_latina',
  'indigenous_native_american_alaska_native',
  'mena',
  'asian_asian_american',
  'native_hawaiian_pacific_islander',
  'white',
  'multiracial_mixed',
  'another_race_ethnicity',
  'prefer_not_to_answer',
] as const;

export type DoulaRaceEthnicityKey = (typeof DOULA_RACE_ETHNICITY_ALLOWED)[number];

export function sanitizeDoulaRaceEthnicity(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const allowed = new Set<string>(DOULA_RACE_ETHNICITY_ALLOWED);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of input) {
    if (typeof item !== 'string') continue;
    const key = item.trim();
    if (!key || !allowed.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}
