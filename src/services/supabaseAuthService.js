'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.SupabaseAuthService = void 0;
const errors_1 = require('./../domains/errors');
class SupabaseAuthService {
  constructor(supabaseClient, userRepository) {
    this.userRepository = userRepository;
    this.supabaseClient = supabaseClient;
  }
  async signup(email, password, firstname, lastname) {
    // Create the auth account in Supabase
    const { data, error } = await this.supabaseClient.auth.signUp({
      email,
      password,
    });
    if (error) {
      throw new errors_1.AuthenticationError(
        `Authentication error: ${error.message}`
      );
    }
    if (!data.user) {
      throw new errors_1.AuthenticationError(
        'User creation failed for unknown reasons'
      );
    }
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      // This shouldn’t happen, but just in case
      await this.supabaseClient.auth.admin.deleteUser(data.user.id);
      throw new errors_1.AuthorizationError(
        'Signup not allowed — not approved.'
      );
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
  async login(email, password) {
    const { data, error } = await this.supabaseClient.auth.signInWithPassword({
      email,
      password: password,
    });
    if (!data.session) {
      throw new errors_1.AuthenticationError('Invalid Credentials');
    }
    if (error) {
      throw new errors_1.AuthenticationError(
        'Authentication error: Sign in failed from Supabase'
      );
    }
    const token = data.session.access_token;
    try {
      const user = await this.userRepository.findByEmail(email);
      return { user, token };
    } catch (error) {
      throw new Error(
        'Authentication error: User could not be found from repository'
      );
    }
  }
  async getMe(token) {
    const {
      data: { user },
      error,
    } = await this.supabaseClient.auth.getUser(token);
    try {
      const user_profile = await this.userRepository.findByEmail(user.email);
      return user_profile;
    } catch (error) {
      throw new Error(
        'Authentication error: getMe could not be found from repository'
      );
    }
  }
  async logout() {
    // logout from supabase
    await this.supabaseClient.auth.signOut();
  }
  async verifyEmail(token_hash, type) {
    const { data, error } = await this.supabaseClient.auth.verifyOtp({
      token_hash,
      type: 'signup',
    });
    if (error) {
      throw new errors_1.AuthenticationError(error.message);
    }
    const access_token = data.session.access_token;
    const refresh_token = data.session.refresh_token;
    const expires_in = data.session.expires_in;
    return { access_token, refresh_token, expires_in };
  }
  async requestPasswordReset(email, redirectTo) {
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
  async resetPassword(token, newPassword) {}
  async getUserFromToken(accessToken) {
    const { data, error } = await this.supabaseClient.auth.getUser(accessToken);
    if (error) {
      throw new Error(error.message);
    }
    // Fetch user from database
    const user = await this.userRepository.findByEmail(data.user.email);
    return user;
  }
  async getGoogleAuthUrl(redirectTo) {
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
  async setSession(token) {
    const { data, error } = await this.supabaseClient.auth.setSession({
      access_token: token,
      refresh_token: token,
    });
    if (error) {
      throw new Error(error.message);
    }
    return data.session;
  }
  async exchangeCodeForSession(code) {
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
  async verifyRecoveryToken(tokenHash) {
    const { data, error } = await this.supabaseClient.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'recovery',
    });
    if (error) {
      throw new Error(error.message);
    }
    return data.session;
  }
  async updateUserPassword(password) {
    const { data, error } = await this.supabaseClient.auth.updateUser({
      password,
    });
    if (error) {
      throw new Error(error.message);
    }
    return data.user;
  }
}
exports.SupabaseAuthService = SupabaseAuthService;
