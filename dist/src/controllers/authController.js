"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const errors_1 = require("../domains/errors");
const supabase_1 = __importDefault(require("../supabase"));
class AuthController {
    constructor(authUseCase) {
        this.authUseCase = authUseCase;
        this.handleError = this.handleError.bind(this);
    }
    //
    // signup()
    //
    // Handles user sign up after being approved by admin (by invite from Admin)
    //
    // returns:
    //    User
    //
    async signup(req, res) {
        try {
            const { email, password, firstname, lastname } = req.body;
            // call useCase to grab newly created user
            const user = await this.authUseCase.signup(email, password, firstname, lastname);
            res.status(201).json({ message: 'User created successfully', user: user.toJSON() });
        }
        catch (signUpError) {
            const error = this.handleError(signUpError, res);
            res.status(error.status).json({ error: error.message });
        }
    }
    //
    // login()
    //
    // Handles user login using email and password for authentication.
    //
    // returns:
    //    User
    //    Token
    //
    async login(req, res) {
        try {
            const { email, password } = req.body;
            // call useCase to grab the user and token
            const result = await this.authUseCase.login(email, password);
            res.status(200).json({ message: 'Login successful', user: result.user.toJSON(), token: result.token });
        }
        catch (loginError) {
            const error = this.handleError(loginError, res);
            res.status(error.status).json({ error: error.message });
        }
    }
    //
    // getMe()
    //
    // Grabs the current user from a token session
    //
    // returns:
    //    User
    //
    async getMe(req, res) {
        try {
            const token = req.cookies?.session || req.headers.authorization?.split(' ')[1];
            if (!token) {
                res.status(401).json({ error: 'No session token provided' });
                return;
            }
            // 1) Get your app user
            const appUser = await this.authUseCase.getMe(token);
            if (!appUser) {
                res.status(404).json({ error: 'User not found' });
                return;
            }
            const base = appUser.toJSON();
            // 2) Fetch Supabase user metadata
            const { data: sbUser, error } = await supabase_1.default.auth.getUser(token);
            let finalRole = base.role; // fallback to the DB role
            if (!error && sbUser.user) {
                const meta = sbUser.user.user_metadata || {};
                if (typeof meta.role === 'string') {
                    finalRole = meta.role;
                }
            }
            // 3) Merge and return
            res.json({
                ...base,
                role: finalRole
            });
        }
        catch (err) {
            const errorInfo = this.handleError(err, res);
            res.status(errorInfo.status).json({ error: errorInfo.message });
        }
    }
    //
    // logout()
    //
    // Signs out of current user and releases session cookie
    //
    // returns:
    //    None
    //
    async logout(_req, res) {
        res.clearCookie('session');
        await this.authUseCase.logout();
        console.log('logged out');
        res.json({ message: 'Logged out successfully' });
    }
    //
    // verifyEmail()
    //
    // Verifies the email after user signs up and redirects to success page
    //
    // returns:
    //    None
    //
    async verifyEmail(req, res) {
        try {
            const token_hash = req.query.token_hash;
            const type = req.query.type;
            // call useCase to return success, query params, and error message
            const queryParams = await this.authUseCase.verifyEmail(token_hash, type);
            // Redirect with tokens if verification is successful
            return res.redirect(`${process.env.FRONTEND_URL}/auth/callback?${queryParams}`);
        }
        catch (error) {
            res.redirect(`${process.env.FRONTEND_URL}/auth/callback?error=${error.message}`);
        }
    }
    //
    // getAllUsers()
    //
    // Retrieves all users from the users table
    //
    // returns:
    //    users => user.toJSON()
    //
    async getAllUsers(_req, res) {
        try {
            const users = await this.authUseCase.getAllUsers();
            res.status(200).json(users.map(user => user.toJSON()));
        }
        catch (getAllUsersError) {
            const error = this.handleError(getAllUsersError, res);
            res.status(error.status).json({ error: error.message });
        }
    }
    //
    // googleAuth()
    //
    // Initiates google oath
    //
    // returns:
    //    url - OAuth URL
    //
    async googleAuth(_req, res) {
        try {
            console.log('starting google auth');
            const redirectTo = `${process.env.FRONTEND_URL}/auth/callback`;
            const url = await this.authUseCase.googleAuth(redirectTo);
            res.json({ url });
        }
        catch (googleAuthError) {
            const error = this.handleError(googleAuthError, res);
            res.status(error.status).json({ error: error.message });
        }
    }
    //
    // handleOAuthCallback()
    //
    // Handles OAuth initiatiation with a cookie and user (new if not existing)
    //
    // returns:
    //    none
    //
    async handleOAuthCallback(req, res) {
        try {
            console.log('OAuth callback received:', req.query);
            const code = req.query.code;
            // call useCase to retrieve current session and user
            const data = await this.authUseCase.handleOAuthCallback(code);
            // create our cookie
            console.log("creating cookie");
            res.cookie('session', data.session.access_token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 3600 * 1000,
                path: '/',
            });
            // Redirect to home page
            res.redirect(`${process.env.FRONTEND_URL}`);
        }
        catch (error) {
            res.redirect(`${process.env.FRONTEND_URL}/login?error=` + encodeURIComponent(error.message));
        }
    }
    //
    // handleToken()
    //
    // Checks that the token is valid and is associated with a user
    //
    // returns:
    //    users => user.toJSON()
    //
    async handleToken(req, res) {
        try {
            const { access_token } = req.body;
            if (!access_token) {
                res.status(401).json({ error: 'No access token provided' });
            }
            const user = await this.authUseCase.handleToken(access_token);
            res.cookie('session', access_token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 3600 * 1000,
                path: '/',
            });
            res.json({ success: true, user: user.toJSON() });
        }
        catch (handleTokenError) {
            console.log(handleTokenError);
            // const error = this.handleError(handleTokenError, res);
            // res.status(error.status).json({ error: error.message})
        }
    }
    //
    // requestPasswordReset()
    //
    // Request password reset and sends link to user
    //
    // returns:
    //    None
    //
    async requestPasswordReset(req, res) {
        try {
            const { email } = req.body;
            const redirectTo = `${process.env.FRONTEND_URL}/auth/reset-password`;
            // call useCase to redirect user to reset password and check for errors
            await this.authUseCase.requestPasswordReset(email, redirectTo);
            res.status(200).json({ message: 'Password reset instructions sent to email' });
        }
        catch (requestPasswordError) {
            const error = this.handleError(requestPasswordError, res);
            res.status(error.status).json({ error: error.message });
        }
    }
    //
    // handlePasswordRecovery()
    //
    // Verify session and directs user to password recovery
    //
    // returns:
    //    None
    //
    async handlePasswordRecovery(req, res) {
        try {
            const token_hash = req.query.token_hash;
            const type = req.query.type;
            // call useCase to retrieve access and refresh tokens.
            const queryParams = await this.authUseCase.handlePasswordRecovery(token_hash, type);
            const redirectUrl = `${process.env.FRONTEND_URL}/auth/reset-password?${queryParams.toString()}`;
            res.redirect(redirectUrl);
        }
        catch {
            res.redirect(`${process.env.FRONTEND_URL}/auth/reset-password?error=${encodeURIComponent('Failed to process password recovery')}`);
        }
    }
    //
    // updatePassword()
    //
    // After being verified, allows user to update password
    //
    // returns:
    //    user
    //
    async updatePassword(req, res) {
        try {
            const { password } = req.body;
            const token = req.headers.authorization?.split(' ')[1];
            const user = await this.authUseCase.updatePassword(password, token);
            res.status(200).json({
                message: 'Password updated successfully',
                user: user.toJSON(),
            });
        }
        catch (updatePasswordError) {
            const error = this.handleError(updatePasswordError, res);
            res.status(error.status).json({ error: error.message });
        }
    }
    // Helper method to handle errors
    handleError(error, res) {
        console.error('Error:', error.message);
        if (error instanceof errors_1.ValidationError) {
            return { status: 400, message: error.message };
        }
        else if (error instanceof errors_1.ConflictError) {
            return { status: 409, message: error.message };
        }
        else if (error instanceof errors_1.AuthenticationError) {
            return { status: 401, message: error.message };
        }
        else if (error instanceof errors_1.NotFoundError) {
            return { status: 404, message: error.message };
        }
        else if (error instanceof errors_1.AuthorizationError) {
            return { status: 403, message: error.message };
        }
        else {
            return { status: 500, message: error.message };
        }
    }
}
exports.AuthController = AuthController;
