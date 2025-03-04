import {
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  NotFoundError,
  ValidationError
} from 'domainErrors';
import { Request, Response } from 'express';
import {
  AuthRequest,
  LoginBody,
  PasswordResetBody,
  SignupBody,
  TokenBody,
  UpdatePasswordBody,
} from 'types';

import { AuthUseCase } from '../authUseCase.js';

export class AuthController {
  private authUseCase: AuthUseCase;

  constructor(authUseCase: AuthUseCase) {
    this.authUseCase = authUseCase;
  }

  //
  // signup()
  //
  // Handles user sign up after being approved by admin (by invite from Admin)
  //
  // returns:
  //    User
  //
  async signup(
    req: Request<object, object, SignupBody>,
    res: Response
  ): Promise<void> {
    try {
      const { email, password, username, firstname, lastname } = req.body;
      // call useCase to grab newly created user
      const user = await this.authUseCase.signup(email, password, username, firstname, lastname);
      res.status(201).json({ message: 'User created successfully', user: user.toJSON() })
    } 
    catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else if (error instanceof ConflictError) {
        res.status(409).json({ error: error.message });
      } else if (error instanceof AuthenticationError) {
        res.status(401).json({ error: error.message });
      } else if (error instanceof NotFoundError) {
        res.status(404).json({ error: error.message });
      } else if (error instanceof AuthorizationError) {
        res.status(403).json({ error: error.message });
      } else {
      res.status(500).json({ error: `Internal server error: ${error.message}` });
      }
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
  async login(
    req: Request<object, object, LoginBody>,
    res: Response
  ): Promise<void> {
    try {
      const { email, password } = req.body;
      // call useCase to grab the user and token
      const { user, token } = await this.authUseCase.login(email, password);
      res.status(200).json({ message: 'Login successful', user: user.toJSON() , token: token });
    } 
    catch (loginError) {
      res.status(500).json({ error: (loginError as Error). message || 'Authentication failed' });
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
  async getMe(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const token = req.cookies?.session || req.headers.authorization?.split(' ')[1];
      // call useCase to grab the current user in the session
      const user = await this.authUseCase.getMe(token);
      res.json(user);
    } 
    catch (error) {
      console.error('getMe endpoint error:', error);
      res.status(500).json({ error: `Authentication failed: ${error}'` });
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
  async logout(
    _req: Request, 
    res: Response
  ): Promise<void> {
    res.clearCookie('session');
    await this.authUseCase.logout();
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
  async verifyEmail(
    req: Request, 
    res: Response
  ): Promise<void> {
    try {
      const token_hash = req.query.token_hash as string;
      const type = req.query.type as string;
      // call useCase to return success, query params, and error message
      const result = await this.authUseCase.verifyEmail(token_hash, type);

      if (result.success) {
        // Redirect with tokens if verification is successful
        return res.redirect(`${process.env.FRONTEND_URL}/auth/callback?${result.queryParams.toString()}`);
      } else {
        // Redirect with error message if verification fails
        return res.redirect(`${process.env.FRONTEND_URL}/auth/callback?error=${encodeURIComponent(result.error)}`);
      }
    } 
    catch {
      res.redirect(`${process.env.FRONTEND_URL}/auth/callback?error=server_error`);
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
  async getAllUsers(
    _req: AuthRequest, 
    res: Response
  ): Promise<void> {
    try {
      const users = await this.authUseCase.getAllUsers();
      res.status(200).json(users.map(user => user.toJSON()));
    }
    catch (error) {
      // console.error('Get all users error:', error);
      res.status(500).json({ error: `Internal server error: ${error}'` });
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
  async googleAuth(
    _req: Request, 
    res: Response
  ): Promise<void> {
    try {
      const url = await this.authUseCase.googleAuth();
      res.json({ url });
    } 
    catch (error) {
      res.status(500).json({ error: `Failed to initialize Google auth: ${error}'` });
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
  async handleOAuthCallback(
    req: Request, 
    res: Response
  ): Promise<void> {
    try {
      const code = req.query.code as string;

      // call useCase to retrieve current session and user
      const data = await this.authUseCase.handleOAuthCallback(code);
      // create our cookie
      res.cookie('session', data.session.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 3600 * 1000,
        path: '/',
      });
      // Redirect to home page
      res.redirect(`${process.env.FRONTEND_URL}`);
    } catch (error) {
      // console.error('OAuth callback error:', error);
      res.redirect(
        `${process.env.FRONTEND_URL}/login?error=` + encodeURIComponent((error as Error).message)
      );
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
  async handleToken(
    req: Request<object, object, TokenBody>,
    res: Response
  ): Promise<void> {
    try {
      const { access_token } = req.body;
      
      const { user, accessToken } = await this.authUseCase.handleToken(access_token);
  
      res.cookie('session', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 3600 * 1000,
        path: '/',
      });

      res.json({ success: true , user: user});
    } catch (error) {
      // console.error('Token handling error:', error);
      res.status(500).json({ error: (error as Error).message });
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
  async requestPasswordReset(
    req: Request<object, object, PasswordResetBody>,
    res: Response
  ): Promise<void> {
    try {
      const { email } = req.body;
      const redirectTo = `${process.env.FRONTEND_URL}/auth/reset-password`;
      
      // call useCase to redirect user to reset password and check for errors
      const error = await this.authUseCase.requestPasswordReset(email, redirectTo);
      
      if (error) {
        res.status(400).json({ error: error.message })
        return;
      }
      res.status(200).json({ message: 'Password reset instructions sent to email'});
    } catch (error) {
      // console.error('Password reset request error:', error);
      res.status(500).json({ error: `Failed to process password reset request: ${error}'` });
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
  async handlePasswordRecovery(
    req: Request, 
    res: Response
  ): Promise<void> {
    try {
      const token_hash = req.query.token_hash as string;
      const type = req.query.type as string;
      
      // call useCase to retrieve access and refresh tokens.
      const result = await this.authUseCase.handlePasswordRecovery(token_hash, type);
      
      if (result.error) {
        res.redirect(
          `${process.env.FRONTEND_URL}/auth/reset-password?error=${encodeURIComponent(result.error)}`
        )
        return;
      }
  
      const queryParams = new URLSearchParams({
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        type: 'recovery',
      });
  
      const redirectUrl = `${process.env.FRONTEND_URL}/auth/reset-password?${queryParams.toString()}`;
      res.redirect(redirectUrl);
    } catch {
      // console.error('Password recovery error:', error);
      res.redirect(
        `${process.env.FRONTEND_URL}/auth/reset-password?error=${encodeURIComponent(
          'Failed to process password recovery'
        )}`
      );
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
  async updatePassword(
    req: Request<object, object, UpdatePasswordBody>,
    res: Response
  ): Promise<void> {
    try {
      const { password } = req.body;
      const token = req.headers.authorization?.split(' ')[1];
      
      const result = await this.authUseCase.updatePassword(password, token);

      if (result.error) {
        res.status(result.status!).json({ error: result.error });
      }
  
      res.status(200).json({
        message: 'Password updated successfully',
        user: result.user.toJSON(),
      });
    } catch (error) {
      // console.error('Password update error:', error);
      res.status(500).json({ error: `Failed to update password: ${error}'` });
    }
  }
}