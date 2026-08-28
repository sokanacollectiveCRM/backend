import { getPool } from '../../db/cloudSqlPool';
import { User } from '../../entities/User';
import { UserRepository } from '../../repositories/interface/userRepository';
import {
  isUuid,
  resolveAuthoritativeRole,
  toRoleEnum,
} from '../../security/resolveAuthoritativeRole';
import { CloudSqlTeamService } from '../cloudSqlTeamService';

const cloudSqlTeamService = new CloudSqlTeamService();

async function findStaffIdByEmail(email: string): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  const pool = getPool();
  const admin = await pool.query(
    `SELECT id FROM public.admins WHERE lower(email) = $1 LIMIT 1`,
    [normalized]
  );
  if (admin.rows[0]?.id) return String(admin.rows[0].id);
  const doula = await pool.query(
    `SELECT id FROM public.doulas WHERE lower(email) = $1 LIMIT 1`,
    [normalized]
  );
  if (doula.rows[0]?.id) return String(doula.rows[0].id);
  return null;
}

async function enrichStaffProfileFromCloudSql(user: User): Promise<User> {
  try {
    let member = null;
    if (isUuid(user.id)) {
      try {
        member = await cloudSqlTeamService.getTeamMemberById(user.id);
      } catch {
        member = null;
      }
    }
    if (!member && user.email) {
      const staffId = await findStaffIdByEmail(user.email);
      if (staffId) {
        member = await cloudSqlTeamService.getTeamMemberById(staffId);
      }
    }
    if (!member) return user;
    user.firstname = member.firstname || user.firstname;
    user.lastname = member.lastname || user.lastname;
    user.first_name = member.firstname || user.first_name;
    user.last_name = member.lastname || user.last_name;
    if (member.email) user.email = member.email;
    user.phone_number = member.phone_number ?? user.phone_number;
    user.address = member.address ?? user.address;
    user.city = member.city ?? user.city;
    user.state = (member.state as any) ?? user.state;
    user.country = member.country ?? user.country;
    user.zip_code =
      member.zip_code != null && member.zip_code !== ''
        ? Number.isNaN(Number(member.zip_code))
          ? user.zip_code
          : Number(member.zip_code)
        : user.zip_code;
    user.bio = member.bio ?? user.bio;
    user.profile_picture =
      (member.profile_picture as any) ?? user.profile_picture;
    user.account_status = (member.account_status as any) ?? user.account_status;
    // Prefer Cloud SQL row id for downstream FK consistency when IdP UID differs.
    if (member.id && member.id !== user.id) {
      user.id = member.id;
    }
    return user;
  } catch {
    return user;
  }
}

export async function loadUserFromIdentityClaims(
  claims: { uid: string; email?: string | null },
  userRepository?: UserRepository
): Promise<User> {
  const email = claims.email?.trim() || '';
  if (userRepository && email) {
    try {
      const existing = await userRepository.findByEmail(email);
      if (existing) {
        const authoritative = await resolveAuthoritativeRole({
          authUserId: claims.uid,
          email: email || existing.email || null,
          appManagedRole: existing.role ?? null,
        });
        existing.role = toRoleEnum(authoritative);
        return enrichStaffProfileFromCloudSql(existing);
      }
    } catch {
      // public.users missing — fall through to Cloud SQL role resolution
    }
  }

  const role = await resolveAuthoritativeRole({
    authUserId: claims.uid,
    email: email || null,
    appManagedRole: null,
  });

  const user = new User({
    id: claims.uid,
    email,
    firstname: '',
    lastname: '',
    first_name: '',
    last_name: '',
    role: toRoleEnum(role),
  });
  return enrichStaffProfileFromCloudSql(user);
}
