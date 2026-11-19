import { User } from '../../entities/User';
import {
  resolveAuthoritativeRole,
  toRoleEnum,
} from '../../security/resolveAuthoritativeRole';
import { ROLE } from '../../types';
import { CloudSqlIdentityUserService } from './cloudSqlIdentityUserService';

const cloudSqlIdentityUserService = new CloudSqlIdentityUserService();

export async function loadUserFromIdentityClaims(claims: {
  uid: string;
  email?: string | null;
}): Promise<User> {
  const email = claims.email?.trim() || '';
  const existing = await cloudSqlIdentityUserService.findUser(claims);
  const resolved = toRoleEnum(
    await resolveAuthoritativeRole({
      authUserId: claims.uid,
      email: existing?.email || email || null,
      appManagedRole: existing?.role ?? null,
    })
  );

  if (existing) {
    if (
      resolved === ROLE.ADMIN ||
      resolved === ROLE.DOULA ||
      resolved === ROLE.BILLING
    ) {
      existing.role = resolved;
    }
    return existing;
  }

  return new User({
    id: claims.uid,
    email,
    firstname: '',
    lastname: '',
    first_name: '',
    last_name: '',
    role: resolved,
  });
}
