import { SupabaseClient } from '@supabase/supabase-js';
import { User } from '../entities/User';
import { UserRepository } from '../repositories/interface/userRepository';
import { AuthService } from '../services/interface/authService';
import {
  AuthenticationError,
  AuthorizationError
} from './../domains/errors';

export class SupabaseAuthService implements AuthService {
  private supabaseClient: SupabaseClient;

  constructor(
    supabaseClient: SupabaseClient,
    private userRepository: UserRepository,
  ) {
    this.supabaseClient = supabaseClient;
  }

  async signup(
    email: string,
    password: string,
    firstname: string,
    lastname: string
  ): Promise<User> {
    // Create the auth account in Supabase
    const { data, error } = await this.supabaseClient.auth.signUp({
      email,
      password,
    });

    if (error) {
      throw new AuthenticationError(`Authentication error: ${error.message}`);
    }

    if (!data.user) {
      throw new AuthenticationError('User creation failed for unknown reasons');
    }

    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      // This shouldn’t happen, but just in case
      await this.supabaseClient.auth.admin.deleteUser(data.user.id);
      throw new AuthorizationError("Signup not allowed — not approved.");
    }

    user.firstname = firstname || null;
    user.lastname = lastname || null;

    // update any details if needed
    try {
      await this.userRepository.save(user);
      return user;
    } catch (error) {
      await this.supabaseClient.auth.admin.deleteUser(data.user.id);
      throw new Error("Failed to update user profile during signup");
    }
  }

  async login(
    email: string,
    password: string
  ): Promise<{user: User, token: string}> {

    const { data, error } = await this.supabaseClient.auth.signInWithPassword({
      email,
      password: password
    });

    if (!data.session) {
      throw new AuthenticationError("Invalid Credentials");
    }

    if (error) {
      throw new AuthenticationError('Authentication error: Sign in failed from Supabase');
    }

    const token = data.session.access_token;

    try {
      const user = await this.userRepository.findByEmail(email);

      return { user, token };
    } catch (error) {
      throw new Error('Authentication error: User could not be found from repository');
    }
  }

  async getMe(
    token: string
  ): Promise<User> {

    const { data: {user}, error } = await this.supabaseClient.auth.getUser(token);

    if (error || !user) {
      throw new Error('Authentication error: Invalid token');
    }

    try {
      const user_profile = await this.userRepository.findByEmail(user.email);

      if (!user_profile) {
        throw new Error('Authentication error: User profile not found in repository');
      }

      return user_profile;

    } catch (error: any) {
      if (error.message.includes('not found')) {
        throw error;
      }
      throw new Error(`Authentication error: getMe could not be found from repository: ${error.message}`);
    }
  }

  async logout(): Promise<void> {
    // logout from supabase
    await this.supabaseClient.auth.signOut();
  }

  async verifyEmail(
    token_hash: string,
    type: string
  ): Promise<{ access_token: string, refresh_token: string, expires_in: number }> {

    const { data, error } = await this.supabaseClient.auth.verifyOtp({
      token_hash,
      type: 'signup',
    });

    if (error) {
      throw new AuthenticationError(error.message);
    }

    const access_token = data.session.access_token;
    const refresh_token = data.session.refresh_token;
    const expires_in = data.session.expires_in

    return { access_token, refresh_token, expires_in };
  }

  async requestPasswordReset(
    email: string,
    redirectTo: string
  ): Promise<void> {
    const { error } = await this.supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  async resetPassword(
    token: string,
    newPassword: string
  ): Promise<void> {

  }

  async getUserFromToken(accessToken: string): Promise<any> {
    const { data, error } = await this.supabaseClient.auth.getUser(accessToken);

    if (error) {
      throw new Error(error.message);
    }

    // Fetch user from database
    const user = await this.userRepository.findByEmail(data.user.email);

    return user;
  }

  async getGoogleAuthUrl(
    redirectTo: string
  ): Promise<string> {


    const { data, error } = await this.supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    return data.url;
  }

  async setSession(token: string): Promise<any> {
    const { data, error } = await this.supabaseClient.auth.setSession({
      access_token: token,
      refresh_token: token,
    });

    if (error) {
      throw new Error(error.message);
    }

    return data.session;
  }

  async exchangeCodeForSession(code: string): Promise<{session: any, userData: any}> {

    const { data, error } = await this.supabaseClient.auth.exchangeCodeForSession(code);

    if (error) {
      throw new Error(error.message);
    }

    return {
      session: data.session,
      userData: data.user
    };
  }

  async verifyRecoveryToken(tokenHash: string): Promise<any> {
    const { data, error } = await this.supabaseClient.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'recovery',
    });

    if (error) {
      throw new Error(error.message);
    }

    return data.session;
  }

  async updateUserPassword(password: string): Promise<any> {
    const { data, error } = await this.supabaseClient.auth.updateUser({
      password,
    });

    if (error) {
      throw new Error(error.message);
    }

    return data.user;
  }
}
