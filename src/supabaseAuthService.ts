import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AuthService } from '../../application/ports/authService';
import { UserRepository } from '../../application/ports/userRepository';
import { User } from '../../domain/entities/User';
import {
  AuthenticationError
} from '../../domain/errors/domainErrors';

export class SupabaseAuthService implements AuthService {
  private supabaseClient: SupabaseClient;
  
  constructor(
    private userRepository: UserRepository,
    private supabaseUrl: string,
    private supabaseKey: string
  ) {
    this.supabaseClient = createClient(supabaseUrl, supabaseKey);
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
      throw new Error(`Failed to create user profile: ${error.message}`);
    }
  }
  
  // Other methods implementing the AuthService interface...
}