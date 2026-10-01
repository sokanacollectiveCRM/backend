import { User } from '../../entities/User';

/**
 * AuthService defines signup against the identity provider.
 * Login, session, and password reset are handled by Firebase outside this port.
 */
export interface AuthService {
  /**
   * Register a new user with the authentication system
   */
  signup(
    email: string,
    password: string,
    firstname: string,
    lastname: string
  ): Promise<User>;
}
