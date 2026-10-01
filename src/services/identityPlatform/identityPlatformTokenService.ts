import { AuthenticationError } from '../../domains/errors';
import { User } from '../../entities/User';
import { SESSION_MAX_AGE_MS } from '../../security/sessionCookies';
import { getFirebaseAuth } from './firebaseAdmin';
import { loadUserFromIdentityClaims } from './loadUserFromIdentity';

type IdentityClaims = {
  uid: string;
  email: string | null;
};

export class IdentityPlatformTokenService {
  async verifyIdToken(idToken: string): Promise<IdentityClaims> {
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

  /**
   * Accept a Firebase session cookie, or a raw ID token when the caller has
   * not exchanged it yet.
   */
  async verifySessionOrIdToken(token: string): Promise<IdentityClaims> {
    const auth = getFirebaseAuth();
    try {
      const decoded = await auth.verifySessionCookie(token, true);
      return {
        uid: decoded.uid,
        email: decoded.email ?? null,
      };
    } catch {
      return this.verifyIdToken(token);
    }
  }

  async createSessionCookie(idToken: string): Promise<string> {
    try {
      return await getFirebaseAuth().createSessionCookie(idToken, {
        expiresIn: SESSION_MAX_AGE_MS,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid token';
      throw new AuthenticationError(
        `Could not create session cookie: ${message}`
      );
    }
  }

  async getUserFromIdToken(idToken: string): Promise<User> {
    return this.userFromClaims(await this.verifyIdToken(idToken));
  }

  async getUserFromSessionToken(token: string): Promise<User> {
    return this.userFromClaims(await this.verifySessionOrIdToken(token));
  }

  private async userFromClaims(claims: IdentityClaims): Promise<User> {
    if (!claims.email) {
      throw new AuthenticationError('Identity token is missing email');
    }
    return loadUserFromIdentityClaims(claims);
  }
}
