import { AuthenticationError } from '../../domains/errors';
import { User } from '../../entities/User';
import { UserRepository } from '../../repositories/interface/userRepository';
import { getFirebaseAuth } from './firebaseAdmin';
import { loadUserFromIdentityClaims } from './loadUserFromIdentity';

export class IdentityPlatformTokenService {
  constructor(private userRepository?: UserRepository) {}

  async verifyIdToken(idToken: string): Promise<{
    uid: string;
    email: string | null;
  }> {
    try {
      const decoded = await getFirebaseAuth().verifyIdToken(idToken, true);
      return {
        uid: decoded.uid,
        email: decoded.email ?? null,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid token';
      throw new AuthenticationError(
        `Invalid or expired Identity Platform token: ${message}`
      );
    }
  }

  async getUserFromIdToken(idToken: string): Promise<User> {
    const claims = await this.verifyIdToken(idToken);
    if (!claims.email) {
      throw new AuthenticationError('Identity token is missing email');
    }
    return loadUserFromIdentityClaims(claims, this.userRepository);
  }
}
