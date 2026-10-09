import { AuthenticationError } from '../../domains/errors';
import { User } from '../../entities/User';
import { SESSION_MAX_AGE_MS } from '../../security/sessionCookies';
import { readLiveEmailVerified } from './emailVerificationService';
import { getFirebaseAuth } from './firebaseAdmin';
import { loadUserFromIdentityClaims } from './loadUserFromIdentity';

export type IdentityClaims = {
  uid: string;
  email: string | null;
  /** From token only; prefer readLiveEmailVerified for access control. */
  emailVerifiedFromToken?: boolean;
};

export type ResolvedSessionUser = {
  user: User;
  firebaseUid: string;
  emailVerified: boolean;
};

export class IdentityPlatformTokenService {
  async verifyIdToken(idToken: string): Promise<IdentityClaims> {
    try {
      const decoded = await getFirebaseAuth().verifyIdToken(idToken, true);
      return {
        uid: decoded.uid,
        email: decoded.email ?? null,
        emailVerifiedFromToken: Boolean(decoded.email_verified),
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
        emailVerifiedFromToken: Boolean(decoded.email_verified),
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
    return (await this.resolveSessionUser(token)).user;
  }

  async resolveSessionUser(token: string): Promise<ResolvedSessionUser> {
    const claims = await this.verifySessionOrIdToken(token);
    const user = await this.userFromClaims(claims);
    const emailVerified = await readLiveEmailVerified(claims.uid);
    user.emailVerified = emailVerified;
    return { user, firebaseUid: claims.uid, emailVerified };
  }

  private async userFromClaims(claims: IdentityClaims): Promise<User> {
    if (!claims.email) {
      throw new AuthenticationError('Identity token is missing email');
    }
    return loadUserFromIdentityClaims(claims);
  }
}
