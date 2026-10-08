export type MembershipRole = 'admin' | 'billing' | 'doula' | 'client';

export type MembershipStatus = 'active' | 'inactive';

export type TenantStatus = 'active' | 'inactive';

export interface MembershipRecord {
  id: string;
  tenantId: string;
  slug: string;
  name: string;
  tenantStatus: TenantStatus;
  principalId: string;
  linkedUserId: string | null;
  identityPlatformUid: string | null;
  email: string | null;
  role: MembershipRole;
  status: MembershipStatus;
}

export interface TenantView {
  id: string;
  slug: string;
  name: string;
  role: MembershipRole;
  membershipId: string;
  /** Sokana organization admins are not platform admins. */
  platformAdmin: false;
}

export interface TenantChoice {
  id: string;
  slug: string;
  name: string;
}
