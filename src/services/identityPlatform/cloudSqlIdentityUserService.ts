import { getPool } from '../../db/cloudSqlPool';
import { User } from '../../entities/User';
import { isUuid } from '../../security/resolveAuthoritativeRole';
import { ROLE } from '../../types';

interface IdentityUserRow {
  principal_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  role: 'admin' | 'doula' | 'client';
  account_status: string | null;
  portal_status: string | null;
  phone_number: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  zip_code: string | null;
  bio: string | null;
  profile_picture: string | null;
}

export interface IdentityClaims {
  uid: string;
  email?: string | null;
}

export interface StaffIdentity {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'doula';
}

function normalizeEmail(email: string | null | undefined): string | null {
  const normalized = email?.trim().toLowerCase() || '';
  return normalized || null;
}

function mapIdentityUser(row: IdentityUserRow): User {
  const user = new User({
    id: row.principal_id,
    email: row.email ?? '',
    firstname: row.first_name ?? '',
    lastname: row.last_name ?? '',
    first_name: row.first_name ?? '',
    last_name: row.last_name ?? '',
    role:
      row.role === 'admin'
        ? ROLE.ADMIN
        : row.role === 'doula'
          ? ROLE.DOULA
          : ROLE.CLIENT,
    account_status: (row.account_status as any) ?? undefined,
    phone_number: row.phone_number ?? undefined,
    address: row.address ?? undefined,
    city: row.city ?? undefined,
    state: (row.state as any) ?? undefined,
    country: row.country ?? undefined,
    zip_code:
      row.zip_code && !Number.isNaN(Number(row.zip_code))
        ? Number(row.zip_code)
        : undefined,
    bio: row.bio ?? undefined,
    profile_picture: (row.profile_picture as any) ?? undefined,
  });
  if (row.portal_status) {
    (user as User & { portal_status?: string }).portal_status =
      row.portal_status;
  }
  return user;
}

function isMissingIdentityLinkColumn(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = String((error as { code?: string }).code || '');
  const message = String((error as { message?: string }).message || '');
  return code === '42703' && message.includes('identity_platform_uid');
}

const PROFILE_QUERY = `
  WITH candidates AS (
    SELECT
      a.id::text AS principal_id,
      a.email,
      COALESCE(a.first_name, split_part(a.full_name, ' ', 1)) AS first_name,
      COALESCE(
        a.last_name,
        NULLIF(btrim(substr(a.full_name, length(split_part(a.full_name, ' ', 1)) + 1)), '')
      ) AS last_name,
      'admin'::text AS role,
      'approved'::text AS account_status,
      NULL::text AS portal_status,
      a.phone AS phone_number,
      a.address,
      a.city,
      a.state,
      a.country,
      a.zip_code,
      a.bio,
      a.profile_picture,
      1 AS priority
    FROM public.admins a
    WHERE a.identity_platform_uid = $1
       OR ($2::uuid IS NOT NULL AND a.id = $2::uuid)
       OR ($3::text IS NOT NULL AND lower(a.email) = $3::text)

    UNION ALL

    SELECT
      d.id::text,
      d.email,
      split_part(d.full_name, ' ', 1),
      NULLIF(btrim(substr(d.full_name, length(split_part(d.full_name, ' ', 1)) + 1)), ''),
      'doula'::text,
      d.account_status,
      NULL::text,
      d.phone,
      d.address,
      d.city,
      d.state,
      d.country,
      d.zip_code,
      d.bio,
      d.profile_picture,
      2
    FROM public.doulas d
    WHERE d.identity_platform_uid = $1
       OR ($2::uuid IS NOT NULL AND d.id = $2::uuid)
       OR ($3::text IS NOT NULL AND lower(d.email) = $3::text)

    UNION ALL

    SELECT
      COALESCE(c.user_id::text, c.id::text),
      c.email,
      c.first_name,
      c.last_name,
      'client'::text,
      c.portal_status,
      c.portal_status,
      c.phone,
      c.address_line1,
      c.city,
      c.state,
      c.country,
      c.zip_code,
      c.bio,
      NULL::text,
      3
    FROM public.phi_clients c
    WHERE c.identity_platform_uid = $1
       OR ($2::uuid IS NOT NULL AND (c.user_id = $2::uuid OR c.id = $2::uuid))
       OR ($3::text IS NOT NULL AND lower(c.email) = $3::text)
  )
  SELECT
    principal_id, email, first_name, last_name, role, account_status,
    portal_status, phone_number, address, city, state, country, zip_code,
    bio, profile_picture
  FROM candidates
  ORDER BY priority
  LIMIT 1
`;

const LEGACY_PROFILE_QUERY = PROFILE_QUERY.replace(
  /\s+[ad]\.(?:identity_platform_uid) = \$1\n\s+OR/g,
  ''
)
  .replace(/\s+c\.(?:identity_platform_uid) = \$1\n\s+OR/g, '')
  .replace(/\$2/g, '$1')
  .replace(/\$3/g, '$2');

/**
 * Resolves an Identity Platform principal against Cloud SQL application rows.
 * Cloud SQL is authoritative for role, lifecycle state, and profile fields.
 */
export class CloudSqlIdentityUserService {
  async findUser(claims: IdentityClaims): Promise<User | null> {
    const normalizedEmail = normalizeEmail(claims.email);
    const idParam = isUuid(claims.uid) ? claims.uid : null;
    const params = [claims.uid, idParam, normalizedEmail];
    try {
      const { rows } = await getPool().query<IdentityUserRow>(
        PROFILE_QUERY,
        params
      );
      return rows[0] ? mapIdentityUser(rows[0]) : null;
    } catch (error) {
      // Permit a safe rolling deployment: legacy schema continues resolving by
      // UUID/email until the identity-link migration has been applied.
      if (!isMissingIdentityLinkColumn(error)) throw error;
      const { rows } = await getPool().query<IdentityUserRow>(
        LEGACY_PROFILE_QUERY,
        [idParam, normalizedEmail]
      );
      return rows[0] ? mapIdentityUser(rows[0]) : null;
    }
  }

  async findStaffByIdentifier(
    identifier: string
  ): Promise<StaffIdentity | null> {
    const user = await this.findUser({ uid: identifier });
    if (user?.role !== ROLE.ADMIN && user?.role !== ROLE.DOULA) return null;
    const name = `${user.firstname ?? ''} ${user.lastname ?? ''}`.trim();
    return {
      id: user.id,
      name: name || user.email || 'Staff member',
      email: user.email || '',
      role: user.role === ROLE.ADMIN ? 'admin' : 'doula',
    };
  }
}
