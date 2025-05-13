import { SupabaseClient } from '@supabase/supabase-js';
import { User } from '../entities/User';
import { UserRepository } from '../repositories/interface/userRepository';
import { AuthService } from '../services/interface/authService';
import {
  AuthenticationError
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
    username: string,
    firstname: string,
    lastname: string
  ): Promise<User> {

    // First, create the auth account in Supabase
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
    
    // Create the user entity in our domain
    const user = new User({
      username,
      email,
      firstname: firstname || null,
      lastname: lastname || null,
    });
    
    // Save the extended user profile to our user repository
    try {
      await this.userRepository.save(user);
      return user;
    } catch (error) {
      // If we can't save the user profile, clean up the auth account
      await this.supabaseClient.auth.admin.deleteUser(data.user.id);
      throw new Error('An account already exists with the provided email');
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

    try {
      const user_profile = await this.userRepository.findByEmail(user.email);

      return user_profile;

    } catch (error) {
      throw new Error('Authentication error: getMe could not be found from repository');
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