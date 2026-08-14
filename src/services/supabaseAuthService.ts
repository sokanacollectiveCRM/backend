import { SupabaseClient } from '@supabase/supabase-js';

import { User } from '../entities/User';
import { UserRepository } from '../repositories/interface/userRepository';
import {
  resolveAuthoritativeRole,
  toRoleEnum,
} from '../security/resolveAuthoritativeRole';
import { AuthService } from '../services/interface/authService';
import { AuthenticationError, AuthorizationError } from './../domains/errors';
import { CloudSqlTeamService } from './cloudSqlTeamService';

const cloudSqlTeamService = new CloudSqlTeamService();

async function enrichStaffProfileFromCloudSql(user: User): Promise<User> {
  try {
    const member = await cloudSqlTeamService.getTeamMemberById(user.id);
    if (!member) return user;
    user.firstname = member.firstname || user.firstname;
    user.lastname = member.lastname || user.lastname;
    user.first_name = member.firstname || user.first_name;
    user.last_name = member.lastname || user.last_name;
    if (member.email) user.email = member.email;
    user.phone_number = member.phone_number ?? user.phone_number;
    user.address = member.address ?? user.address;
    user.city = member.city ?? user.city;
    user.state = (member.state as any) ?? user.state;
    user.country = member.country ?? user.country;
    user.zip_code =
      member.zip_code != null && member.zip_code !== ''
        ? Number.isNaN(Number(member.zip_code))
          ? user.zip_code
          : Number(member.zip_code)
        : user.zip_code;
    user.bio = member.bio ?? user.bio;
    user.profile_picture =
      (member.profile_picture as any) ?? user.profile_picture;
    user.account_status = (member.account_status as any) ?? user.account_status;
    return user;
  } catch {
    return user;
  }
}

/** Build app User from Supabase auth user when public.users is missing or has no row. */
async function userFromAuthUser(authUser: {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
}): Promise<User> {
  const meta = authUser.user_metadata || {};
  // PR 6: never grant staff from user_metadata / app_metadata.
  const role = await resolveAuthoritativeRole({
    authUserId: authUser.id,
    email: authUser.email ?? null,
    appManagedRole: null,
  });
  const user = new User({
    id: authUser.id,
    email: authUser.email || '',
    firstname: (meta.first_name as string) || (meta.firstname as string) || '',
    lastname: (meta.last_name as string) || (meta.lastname as string) || '',
    first_name: (meta.first_name as string) || (meta.firstname as string) || '',
    last_name: (meta.last_name as string) || (meta.lastname as string) || '',
    role: toRoleEnum(role),
  });
  return enrichStaffProfileFromCloudSql(user);
}

export class SupabaseAuthService implements AuthService {
  private supabaseClient: SupabaseClient;

  constructor(
    supabaseClient: SupabaseClient,
    private userRepository: UserRepository
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
      throw new AuthorizationError('Signup not allowed — not approved.');
    }

    user.firstname = firstname || null;
    user.lastname = lastname || null;

    // update any details if needed
    try {
      await this.userRepository.save(user);
      return user;
    } catch (error) {
      await this.supabaseClient.auth.admin.deleteUser(data.user.id);
      throw new Error('Failed to update user profile during signup');
    }
  }

  async login(
    email: string,
    password: string
  ): Promise<{ user: User; token: string }> {
    let result: Awaited<
      ReturnType<typeof this.supabaseClient.auth.signInWithPassword>
    >;

    try {
      result = await this.supabaseClient.auth.signInWithPassword({
        email,
        password: password,
      });
    } catch (networkErr: unknown) {
      const msg =
        networkErr instanceof Error ? networkErr.message : String(networkErr);
      const cause =
        networkErr instanceof Error && 'cause' in networkErr
          ? (networkErr.cause as { code?: string })
          : undefined;
      const isTimeoutOrNetwork =
        msg.includes('fetch failed') ||
        msg.includes('timeout') ||
        msg.includes('ECONNREFUSED') ||
        cause?.code === 'UND_ERR_CONNECT_TIMEOUT';
      if (isTimeoutOrNetwork) {
        console.warn('[auth] Supabase unreachable', {
          email: email?.trim?.() || '(missing)',
          reason: msg,
        });
        throw new AuthenticationError(
          'Authentication service temporarily unavailable. Please try again.'
        );
      }
      throw networkErr;
    }

    const { data, error } = result;

    if (error) {
      console.warn('[auth] Login failed', {
        email: email?.trim?.() || '(missing)',
        reason: error.message,
      });
      throw new AuthenticationError(
        error.message || 'Sign in failed from Supabase'
      );
    }

    if (!data.session) {
      console.warn('[auth] Login failed: no session', {
        email: email?.trim?.() || '(missing)',
      });
      throw new AuthenticationError('Invalid Credentials');
    }

    const token = data.session.access_token;
    const authUser = data.user;

    try {
      const user = await this.userRepository.findByEmail(email);
      if (user) {
        const authoritative = await resolveAuthoritativeRole({
          authUserId: authUser.id,
          email: authUser.email ?? user.email ?? email,
          appManagedRole: user.role ?? null,
        });
        user.role = toRoleEnum(authoritative);
        return { user: await enrichStaffProfileFromCloudSql(user), token };
      }
    } catch {
      // public.users missing or no row — use Cloud SQL / default client
    }
    return { user: await userFromAuthUser(authUser), token };
  }

  async getMe(token: string): Promise<User> {
    const {
      data: { user },
      error,
    } = await this.supabaseClient.auth.getUser(token);

    if (error || !user) {
      throw new Error('Authentication error: Invalid token');
    }

    try {
      const user_profile = await this.userRepository.findByEmail(
        user.email ?? ''
      );
      if (user_profile) {
        const authoritative = await resolveAuthoritativeRole({
          authUserId: user.id,
          email: user.email ?? user_profile.email ?? null,
          appManagedRole: user_profile.role ?? null,
        });
        user_profile.role = toRoleEnum(authoritative);
        return enrichStaffProfileFromCloudSql(user_profile);
      }
    } catch {
      // public.users missing or no row
    }
    return userFromAuthUser(user);
  }

  async logout(): Promise<void> {
    // logout from supabase
    await this.supabaseClient.auth.signOut();
  }

  async verifyEmail(
    token_hash: string,
    type: string
  ): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }> {
    const { data, error } = await this.supabaseClient.auth.verifyOtp({
      token_hash,
      type: 'signup',
    });

    if (error) {
      throw new AuthenticationError(error.message);
    }

    const access_token = data.session.access_token;
    const refresh_token = data.session.refresh_token;
    const expires_in = data.session.expires_in;

    return { access_token, refresh_token, expires_in };
  }

  async requestPasswordReset(email: string, redirectTo: string): Promise<void> {
    const { error } = await this.supabaseClient.auth.resetPasswordForEmail(
      email,
      {
        redirectTo,
      }
    );

    if (error) {
      throw new Error(error.message);
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {}

  async getUserFromToken(accessToken: string): Promise<any> {
    const { data, error } = await this.supabaseClient.auth.getUser(accessToken);

    if (error) {
      throw new Error(error.message);
    }

    if (!data?.user) {
      throw new Error('Invalid token');
    }

    try {
      const user = await this.userRepository.findByEmail(data.user.email ?? '');
      if (user) {
        const authoritative = await resolveAuthoritativeRole({
          authUserId: data.user.id,
          email: data.user.email ?? user.email ?? null,
          appManagedRole: user.role ?? null,
        });
        user.role = toRoleEnum(authoritative);
        return enrichStaffProfileFromCloudSql(user);
      }
    } catch {
      // public.users missing or no row
    }
    return userFromAuthUser(data.user);
  }

  async getGoogleAuthUrl(redirectTo: string): Promise<string> {
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

  async exchangeCodeForSession(
    code: string
  ): Promise<{ session: any; userData: any }> {
    const { data, error } =
      await this.supabaseClient.auth.exchangeCodeForSession(code);

    if (error) {
      throw new Error(error.message);
    }

    return {
      session: data.session,
      userData: data.user,
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
