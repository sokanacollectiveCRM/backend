import { User } from 'entities/User';

/**
 * AuthService defines the interface for authentication operations.
 * This is a "port" in the hexagonal architecture sense - it defines
 * how the application layer communicates with the authentication infrastructure.
 */
export interface AuthService {
  /**
   * Register a new user with the authentication system
   */
  signup(
    email: string,
    password: string,
    username: string,
    firstname: string,
    lastname: string
  ): Promise<User>;
  
  /**
   * Authenticate a user and return their information
   */
  login(
    email: string,
    password: string
  ): Promise<{user: User, token: string}>;

  /**
   * Get the current user based on the token
   */
  getMe(
    token: string
  ): Promise<User>
  
  /**
   * Log a user out of the system
   */
  logout(): Promise<void>;

  /**
   * Verifies user and returns a token
   */
  verifyEmail(
    token_hash: string, 
    type: string
  ): Promise<{ access_token: string, refresh_token: string, expires_in: number }>;
  
  /**
   * Request a password reset email
   */
  requestPasswordReset(
    email: string, 
    redirectTo: string
  ): Promise<void>;
  
  /**
   * Reset a password using a reset token
   */
  resetPassword(
    token: string, 
    newPassword: string
  ): Promise<void>;
  
  /**
   * Get Google OAuth URL
   */
  getGoogleAuthUrl(
    redirectTo: string
  ): Promise<string>;
  
  /**
   * Exchange OAuth code for session
   */
  exchangeCodeForSession(
    code: string
  ): Promise<{session: any, userData: any}>;
  
  /**
   * Get user from access token
   */
  getUserFromToken(
    accessToken: string
  ): Promise<any>;
  
  /**
   * Set session from token
   */
  setSession(
    token: string
  ): Promise<any>;
  
  /**
   * Update user password
   */
  updateUserPassword(
    password: string
  ): Promise<any>;
  
  /**
   * Verify recovery token
   */
  verifyRecoveryToken(
    tokenHash: string
  ): Promise<any>;
  
  /**
   * Verify email
   */
  verifyEmail(
    tokenHash: string, 
    type: string
  ): Promise<any>;
}