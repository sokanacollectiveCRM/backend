import { SupabaseClient } from '@supabase/supabase-js';

import { User } from '../entities/User';
import { UserRepository } from '../repositories/interface/userRepository';
import { AuthService } from '../services/interface/authService';
import { AuthenticationError, AuthorizationError } from './../domains/errors';
import { getFirebaseAuth } from './identityPlatform/firebaseAdmin';

export class SupabaseAuthService implements AuthService {
  constructor(
    supabaseClient: SupabaseClient,
    private userRepository: UserRepository
  ) {
    void supabaseClient;
  }

  async signup(
    email: string,
    password: string,
    firstname: string,
    lastname: string
  ): Promise<User> {
    const auth = getFirebaseAuth();
    let createdUid: string | undefined;
    try {
      const created = await auth.createUser({
        email,
        password,
        emailVerified: false,
        displayName:
          [firstname, lastname].filter(Boolean).join(' ').trim() || undefined,
      });
      createdUid = created.uid;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'User creation failed';
      throw new AuthenticationError(`Authentication error: ${message}`);
    }

    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      if (createdUid) await auth.deleteUser(createdUid);
      throw new AuthorizationError('Signup not allowed — not approved.');
    }

    user.firstname = firstname || null;
    user.lastname = lastname || null;

    try {
      await this.userRepository.save(user);
      return user;
    } catch {
      if (createdUid) await auth.deleteUser(createdUid);
      throw new Error('Failed to update user profile during signup');
    }
  }
}
