"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthUseCase = void 0;
const errors_1 = require("../domains/errors");
const User_1 = require("../entities/User");
class AuthUseCase {
    constructor(authService, userRepository) {
        this.authService = authService;
        this.userRepository = userRepository;
    }
    //
    // Sign up the user if they are already in the users table
    //
    // returns:
    //    user
    //
    async signup(email, password, firstname, lastname) {
        if (!email || !password) {
            throw new errors_1.ValidationError("Email and password are required");
        }
        if (password.length < 8) {
            throw new errors_1.ValidationError("Password must be at least 8 characters long");
        }
        // Check that the user is pre-approved by an admin
        const existingUser = await this.userRepository.findByEmail(email);
        if (!existingUser) {
            throw new errors_1.AuthorizationError("You are not authorized to sign up. Please email the office if the issue persists.");
        }
        if (existingUser.account_status !== 'pending') {
            throw new errors_1.AuthorizationError("This account already exists");
        }
        // Continue with signup
        return await this.authService.signup(email, password, firstname, lastname);
    }
    //
    // login if valid credentials
    //
    // returns:
    //    user
    //
    async login(email, password) {
        if (!email || !password) {
            throw new errors_1.ValidationError("Email and password are required");
        }
        try {
            const existingUser = await this.userRepository.findByEmail(email);
            if (!existingUser) {
                throw new errors_1.AuthorizationError("Invalid credentials. Please try again or contact the office.");
            }
            // let auth service return the user who just logged in alongside the session token
            const { user, token } = await this.authService.login(email, password);
            return { user, token };
        }
        catch (error) {
            throw new errors_1.AuthenticationError(error.message);
        }
    }
    //
    // forward to authService the token to retrieve user
    //
    // returns:
    //    user
    //
    async getMe(token) {
        if (!token) {
            throw new errors_1.AuthenticationError("Not authenticated");
        }
        try {
            // let auth service return the user we requested
            const user = await this.authService.getMe(token);
            return user;
        }
        catch (error) {
            throw new errors_1.AuthenticationError(error.message);
        }
    }
    //
    // signs out current user from the auth service
    //
    // returns:
    //    none
    //
    async logout() {
        await this.authService.logout();
    }
    //
    // redirect user to our custom verification page with a valid supabase otp
    //
    // returns:
    //    user
    //
    async verifyEmail(token_hash, type) {
        if (!token_hash || type != 'signup') {
            throw new errors_1.ValidationError("invalid_verification");
        }
        try {
            const session = await this.authService.verifyEmail(token_hash, type);
            const queryParams = new URLSearchParams({
                access_token: session.access_token,
                refresh_token: session.refresh_token,
                expires_in: session.expires_in.toString(),
                type: 'signup',
            }).toString();
            return queryParams;
        }
        catch (error) {
            throw new errors_1.AuthenticationError(error.message);
        }
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
        }
        catch (error) {
            throw new errors_1.AuthenticationError(`Error fetching users: ${error.message}`);
        }
    }
    //
    // redirect to google auth service
    //
    // returns:
    //    user
    //
    async googleAuth(redirectTo) {
        try {
            const url = await this.authService.getGoogleAuthUrl(redirectTo);
            return url;
        }
        catch (error) {
            throw new errors_1.AuthenticationError(`Failed to initialize Google auth: ${error.message}`);
        }
    }
    //
    // handle response from google oauth
    //
    // returns:
    //    user
    //
    async handleOAuthCallback(code) {
        if (!code) {
            throw new errors_1.ValidationError('No code provided');
        }
        try {
            // Exchange code for session
            const { session, userData } = await this.authService.exchangeCodeForSession(code);
            // Check if user exists
            let user = await this.userRepository.findByEmail(userData.email);
            // User should already exist in users table
            if (!user) {
                throw new errors_1.AuthorizationError('You are not authorized to sign in. Please email the office if the issue persists.');
            }
            return { session, user };
        }
        catch (error) {
            throw new errors_1.AuthenticationError(`${error.message}`);
        }
    }
    //
    // forward to authService to authenticate and return our user
    //
    // returns:
    //    user
    //
    async handleToken(accessToken) {
        if (!accessToken) {
            throw new errors_1.ValidationError('No access token provided');
        }
        try {
            // Get user data from token
            let user = await this.authService.getUserFromToken(accessToken);
            // Create user if doesn't exist
            if (!user) {
                const newUser = new User_1.User({
                    email: user.email,
                    firstname: user.user_metadata?.given_name ||
                        user.user_metadata?.name?.split(' ')[0] ||
                        null,
                    lastname: user.user_metadata?.family_name ||
                        user.user_metadata?.name?.split(' ')[1] ||
                        null,
                });
                user = await this.userRepository.save(newUser);
            }
            return user;
        }
        catch (error) {
            throw new errors_1.AuthenticationError(`Token handling error: ${error.message}`);
        }
    }
    //
    // forward to authService to authenticate and return our user
    //
    // returns:
    //    user
    //
    async requestPasswordReset(email, redirectTo) {
        if (!email) {
            throw new errors_1.ValidationError('Email is required');
        }
        try {
            await this.authService.requestPasswordReset(email, redirectTo);
        }
        catch (error) {
            throw new errors_1.AuthenticationError(`Failed to process password reset request: ${error.message}`);
        }
    }
    //
    // forward to authService to authenticate and return our user
    //
    // returns:
    //    user
    //
    async handlePasswordRecovery(tokenHash, type) {
        if (!tokenHash || type !== 'recovery') {
            throw new errors_1.ValidationError('Invalid password recovery link');
        }
        try {
            const session = await this.authService.verifyRecoveryToken(tokenHash);
            const queryParams = new URLSearchParams({
                access_token: session.access_token,
                refresh_token: session.refresh_token,
                type: 'recovery',
            }).toString();
            return queryParams;
        }
        catch (error) {
            throw new errors_1.AuthenticationError(`Failed to process password recovery: ${error.message}`);
        }
    }
    //
    // forward to authService to authenticate and return our user
    //
    // returns:
    //    user
    //
    async updatePassword(password, token) {
        if (!password) {
            throw new errors_1.ValidationError('New password is required');
        }
        if (!token) {
            throw new errors_1.ValidationError('Authorization token is required');
        }
        try {
            // Validate session
            await this.authService.setSession(token);
            // Update password
            const userData = await this.authService.updateUserPassword(password);
            // Get domain user
            const user = await this.userRepository.findByEmail(userData.email);
            if (!user) {
                throw new errors_1.NotFoundError('User not found');
            }
            return user;
        }
        catch (error) {
            if (error instanceof errors_1.NotFoundError) {
                throw error;
            }
            throw new errors_1.AuthenticationError(`Failed to update password: ${error.message}`);
        }
    }
}
exports.AuthUseCase = AuthUseCase;
