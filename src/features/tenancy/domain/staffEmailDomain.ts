export function normalizeStaffEmailDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^@+/, '');
}

/** True when the address uses exactly the organization's staff domain. */
export function emailMatchesStaffDomain(
  email: string,
  orgDomain: string
): boolean {
  const domain = normalizeStaffEmailDomain(orgDomain);
  if (!domain || domain.includes('@') || !domain.includes('.')) return false;
  const normalizedEmail = email.trim().toLowerCase();
  const at = normalizedEmail.lastIndexOf('@');
  if (at <= 0 || at === normalizedEmail.length - 1) return false;
  return normalizedEmail.slice(at + 1) === domain;
}

export function staffInviteDomainMessage(orgDomain: string): string {
  return `Admins and doulas must use an @${normalizeStaffEmailDomain(orgDomain)} email address.`;
}
