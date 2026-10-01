import {
  AuthenticationError,
  AuthorizationError,
  ValidationError,
} from '../domains/errors';
import { User } from '../entities/User';
import { UserRepository } from '../repositories/interface/userRepository';
import { AuthService } from '../services/interface/authService';

export class AuthUseCase {
  private authService: AuthService;
  private userRepository: UserRepository;

  constructor(authService: AuthService, userRepository: UserRepository) {
    this.authService = authService;
    this.userRepository = userRepository;
  }

  //
  // Sign up the user if they are already in the users table
  //
  // returns:
  //    user
  //
  async signup(
    email: string,
    password: string,
    firstname: string,
    lastname: string
  ): Promise<User> {
    if (!email || !password) {
      throw new ValidationError('Email and password are required');
    }

    if (password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters long');
    }

    // Check that the user is pre-approved by an admin
    const existingUser = await this.userRepository.findByEmail(email);
    if (!existingUser) {
      console.error(
        `❌ Signup attempt for ${email}: User not found in database. User must be invited by an admin first.`
      );
      throw new AuthorizationError(
        'You are not authorized to sign up. Please email the office if the issue persists.'
      );
    }
    console.log(
      `✅ Found user ${email} with account_status: ${existingUser.account_status}`
    );
    if (existingUser.account_status !== 'pending') {
      console.warn(
        `⚠️  Signup attempt for ${email}: account_status is '${existingUser.account_status}', expected 'pending'`
      );
      throw new AuthorizationError('This account already exists');
    }

    // Continue with signup
    return await this.authService.signup(email, password, firstname, lastname);
  }

  //
  // get all users
  //
  // returns:
  //    user
  //
  async getAllUsers() {
    try {
      const users = await this.userRepository.findAll();
      return users;
    } catch (error) {
      throw new AuthenticationError(`Error fetching users: ${error.message}`);
    }
  }
}
