export function isTenancyEnforced(): boolean {
  const value = (process.env.TENANCY_ENFORCE || '').trim().toLowerCase();
  return value === 'on' || value === 'true' || value === '1';
}
