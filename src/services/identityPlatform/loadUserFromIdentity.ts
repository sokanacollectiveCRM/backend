import { User } from '../../entities/User';
import { ROLE } from '../../types';
import { CloudSqlIdentityUserService } from './cloudSqlIdentityUserService';

const cloudSqlIdentityUserService = new CloudSqlIdentityUserService();

export async function loadUserFromIdentityClaims(claims: {
  uid: string;
  email?: string | null;
}): Promise<User> {
  const email = claims.email?.trim() || '';
  const existing = await cloudSqlIdentityUserService.findUser(claims);
  if (existing) return existing;

  return new User({
    id: claims.uid,
    email,
    firstname: '',
    lastname: '',
    first_name: '',
    last_name: '',
    role: ROLE.CLIENT,
  });
}
