import { User } from './User';
import {
  AuthenticationError,
  ValidationError
} from './domainErrors';
import { SupabaseAuthService } from './supabaseAuthService';

export class AuthUseCase {
  private supabaseAuthService: SupabaseAuthService;

  constructor(supabaseAuthService: SupabaseAuthService) {
    this.supabaseAuthService = this.supabaseAuthService;
  }

  async signup(
    email: string, 
    password: string, 
    username: string, 
    firstname: string, 
    lastname: string
  ): Promise<User> {

    if (!email || !password || !username) {
      throw new ValidationError("Email, password, and username are required");
    }

    if (password.length < 8) {
      throw new ValidationError("Password must be at least 8 characters long");
    }

    try {
      // Let auth service call supabase for us
      const user = await this.supabaseAuthService.signup(
        email,
        password,
        username,
        firstname,
        lastname
      );

      return user;
    }
    catch (error) {
      throw new AuthenticationError('Authentication error: ${error.message}');
    }
  }


}