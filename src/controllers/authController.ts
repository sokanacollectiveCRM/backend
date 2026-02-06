import { Request, Response } from 'express';

import {
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  NotFoundError,
  ValidationError
} from '../domains/errors';
import supabase from '../supabase';
import {
  AuthRequest,
  LoginBody,
  PasswordResetBody,
  SignupBody,
  TokenBody,
  UpdatePasswordBody,
} from '../types';
import { AuthUseCase } from '../usecase/authUseCase.js';
import { logger } from '../common/utils/logger';


export class AuthController {
  private authUseCase: AuthUseCase;

  constructor(authUseCase: AuthUseCase) {
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
  async signup(
    req: Request<object, object, SignupBody>,
    res: Response
  ): Promise<void> {
    try {
      const { email, password, firstname, lastname } = req.body;
      // call useCase to grab newly created user
      const user = await this.authUseCase.signup(email, password, firstname, lastname);
      res.status(201).json({ message: 'User created successfully', user: user.toJSON() })
    }
    catch (signUpError) {
      const error = this.handleError(signUpError, res);
      res.status(error.status).json({ error: error.message})
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
      const result = await this.authUseCase.login(email, password);
      res.cookie('sb-access-token', result.token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 3600000,
        path: '/',
      });
      res.status(200).json({ message: 'Login successful', user: result.user.toJSON() });
    }
    catch (loginError) {
      const error = this.handleError(loginError, res);
      res.status(error.status).json({ error: error.message})
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
  async getMe(req: Request, res: Response): Promise<void> {
    try {
      const token: string | undefined = req.cookies?.['sb-access-token'];
      if (!token) {
        logger.warn({ context: 'AuthController.getMe' }, 'No token found in request');
        res.status(401).json({ error: 'No session token provided' })
        return
      }

      // Validate token format (JWT should have 3 parts separated by dots)
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) {
        logger.error({
          context: 'AuthController.getMe',
          tokenLength: token.length,
          tokenPreview: token.substring(0, 50) + '...',
          partsCount: tokenParts.length,
        }, 'Invalid JWT format');
        res.status(401).json({ error: 'Invalid token format: JWT must have 3 parts', details: `Received ${tokenParts.length} parts, expected 3` })
        return
      }

      // 1) Get your app user
      const appUser = await this.authUseCase.getMe(token)
      if (!appUser) {
        res.status(404).json({ error: 'User not found' })
        return
      }
      const base = appUser.toJSON()

      // 2) Fetch Supabase user metadata
      const { data: sbUser, error } = await supabase.auth.getUser(token)
      let finalRole = (base as any).role  // fallback to the DB role

      if (!error && sbUser.user) {
        const meta = (sbUser.user.user_metadata as any) || {}
        if (typeof meta.role === 'string') {
          finalRole = meta.role
        }
      }

      // 3) Merge and return
      res.json({
        ...(base as any),
        role: finalRole
      })
    } catch (err: any) {
      const errorInfo = this.handleError(err, res)
      res.status(errorInfo.status).json({ error: errorInfo.message })
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
    res.clearCookie('sb-access-token', {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
    });
    res.clearCookie('session');
    await this.authUseCase.logout();
    logger.info({ context: 'AuthController.logout' }, 'Logged out');
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
  async getAllUsers(
    _req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const users = await this.authUseCase.getAllUsers();
      res.status(200).json(users.map(user => user.toJSON()));
    }
    catch (getAllUsersError) {
      const error = this.handleError(getAllUsersError, res);
      res.status(error.status).json({ error: error.message})
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
      logger.info({ context: 'AuthController.googleAuth' }, 'Starting google auth');
      const redirectTo = `${process.env.FRONTEND_URL}/auth/callback`;
      const url = await this.authUseCase.googleAuth(redirectTo);
      res.json({ url });
    }
    catch (googleAuthError) {
      const error = this.handleError(googleAuthError, res);
      res.status(error.status).json({ error: error.message})
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
      logger.info({ context: 'AuthController.handleOAuthCallback', query: req.query }, 'OAuth callback received');
      const code = req.query.code as string;

      // call useCase to retrieve current session and user
      const data = await this.authUseCase.handleOAuthCallback(code);
      // create our cookie
      logger.info({ context: 'AuthController.handleOAuthCallback' }, 'Creating session cookie');
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
      res.redirect(
        `${process.env.FRONTEND_URL}/login?error=` + encodeURIComponent(error.message)
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

      res.json({ success: true , user: user.toJSON()});
    } catch (handleTokenError) {
      logger.error({ err: handleTokenError, context: 'AuthController.handleToken' }, 'Handle token failed');
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
  async requestPasswordReset(
    req: Request<object, object, PasswordResetBody>,
    res: Response
  ): Promise<void> {
    try {
      const { email } = req.body;
      const redirectTo = `${process.env.FRONTEND_URL}/auth/reset-password`;

      // call useCase to redirect user to reset password and check for errors
      await this.authUseCase.requestPasswordReset(email, redirectTo);

      res.status(200).json({ message: 'Password reset instructions sent to email'});
    } catch (requestPasswordError) {
      const error = this.handleError(requestPasswordError, res);
      res.status(error.status).json({ error: error.message})
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
      const queryParams = await this.authUseCase.handlePasswordRecovery(token_hash, type);

      const redirectUrl = `${process.env.FRONTEND_URL}/auth/reset-password?${queryParams.toString()}`;
      res.redirect(redirectUrl);
    } catch {
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

      const user = await this.authUseCase.updatePassword(password, token);

      res.status(200).json({
        message: 'Password updated successfully',
        user: user.toJSON(),
      });
    } catch (updatePasswordError) {
      const error = this.handleError(updatePasswordError, res);
      res.status(error.status).json({ error: error.message})
    }
  }

  // Helper method to handle errors
  private handleError(
    error: Error,
    res: Response
  ): { status: number, message: string } {
    logger.error({ err: error, context: 'AuthController.handleError' }, 'Error handling request');

    if (error instanceof ValidationError) {
      return { status: 400, message: error.message};
    } else if (error instanceof ConflictError) {
      return { status: 409, message: error.message};
    } else if (error instanceof AuthenticationError) {
      return { status: 401, message: error.message};
    } else if (error instanceof NotFoundError) {
      return { status: 404, message: error.message};
    } else if (error instanceof AuthorizationError) {
      return { status: 403, message: error.message};
    } else {
      return { status: 500, message: error.message};
    }
  }
}
