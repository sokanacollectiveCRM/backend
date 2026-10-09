import { Request, Response } from 'express';

import { logger } from '../../../common/utils/logger';
import { toSafeProviderError } from '../../../common/utils/safeLogging';
import {
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../../domains/errors';
import {
  TENANT_HEADER,
  isTenancyEnforced,
  resolveTenantGate,
} from '../../../features/tenancy';
import { getSessionToken } from '../../../middleware/authMiddleware';
import { ApiErrorCode } from '../../../security/errorCodes';
import { isStaffRole } from '../../../security/resolveAuthoritativeRole';
import {
  clearSessionCookies,
  setSessionCookie,
} from '../../../security/sessionCookies';
import { CloudSqlTeamService } from '../../../services/cloudSqlTeamService';
import { attachDisplayProfilePicture } from '../../../services/gcs/profilePictureStorage';
import { EmailMfaChallengeService } from '../../../services/identityPlatform/emailMfaChallengeService';
import {
  emailVerificationService,
  readLiveEmailVerified,
} from '../../../services/identityPlatform/emailVerificationService';
import { getFirebaseAuth } from '../../../services/identityPlatform/firebaseAdmin';
import { IdentityPlatformTokenService } from '../../../services/identityPlatform/identityPlatformTokenService';
import { AuthRequest, LoginBody, SignupBody } from '../../../types';
import { AuthUseCase } from '../../../usecase/authUseCase.js';

export class AuthController {
  private authUseCase: AuthUseCase;
  private cloudSqlTeamService = new CloudSqlTeamService();
  private identityTokenService: IdentityPlatformTokenService;
  private emailMfaService = new EmailMfaChallengeService();

  constructor(
    authUseCase: AuthUseCase,
    identityTokenService?: IdentityPlatformTokenService
  ) {
    this.authUseCase = authUseCase;
    this.identityTokenService =
      identityTokenService ?? new IdentityPlatformTokenService();
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
      const user = await this.authUseCase.signup(
        email,
        password,
        firstname,
        lastname
      );
      res
        .status(201)
        .json({ message: 'User created successfully', user: user.toJSON() });
    } catch (signUpError) {
      const error = this.handleError(signUpError, res);
      res.status(error.status).json({ error: error.message });
    }
  }

  //
  // login()
  //
  // Exchanges a Firebase ID token for an HttpOnly session cookie.
  //
  async login(
    req: Request<object, object, LoginBody>,
    res: Response
  ): Promise<void> {
    try {
      const idToken = req.body?.idToken?.trim();
      if (!idToken) {
        res.status(400).json({ error: 'idToken is required' });
        return;
      }

      const claims = await this.identityTokenService.verifyIdToken(idToken);
      const user = await this.identityTokenService.getUserFromIdToken(idToken);
      user.emailVerified = await readLiveEmailVerified(claims.uid);
      await attachDisplayProfilePicture(user);
      const sessionCookie =
        await this.identityTokenService.createSessionCookie(idToken);
      setSessionCookie(res, sessionCookie);
      res.status(200).json({
        message: 'Login successful',
        user: user.toJSON(),
      });
    } catch (loginError) {
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
  async getMe(req: Request, res: Response): Promise<void> {
    try {
      const token = getSessionToken(req as any);
      if (!token) {
        logger.warn(
          { context: 'AuthController.getMe' },
          'No token found in request'
        );
        res.status(401).json({
          error: 'No session token provided',
          code: 'UNAUTHENTICATED',
          hint: 'Provide Cookie or X-Session-Token header',
        });
        return;
      }

      // Validate token format (JWT should have 3 parts separated by dots)
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) {
        logger.error(
          {
            context: 'AuthController.getMe',
            partsCount: tokenParts.length,
          },
          'Invalid JWT format'
        );
        res.status(401).json({
          error: 'Invalid token format: JWT must have 3 parts',
          details: `Received ${tokenParts.length} parts, expected 3`,
        });
        return;
      }

      const { user: appUser } =
        await this.identityTokenService.resolveSessionUser(token);
      if (!appUser) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const requestedTenant = req.header(TENANT_HEADER);
      const gate = await resolveTenantGate({
        userId: String(appUser.id || ''),
        email: appUser.email,
        requestedTenant: requestedTenant?.trim() || null,
        currentRole: appUser.role ? String(appUser.role) : null,
      });
      if (gate.action === 'deny') {
        res.status(gate.status).json({
          error: gate.error,
          code: gate.code,
          ...(gate.tenants ? { tenants: gate.tenants } : {}),
        });
        return;
      }

      await attachDisplayProfilePicture(appUser);
      const body = appUser.toJSON() as Record<string, unknown>;
      if (gate.action === 'attach') {
        body.tenant = {
          id: gate.tenant.id,
          slug: gate.tenant.slug,
          name: gate.tenant.name,
          role: gate.tenant.role,
        };
        if (isTenancyEnforced()) {
          body.role = gate.tenant.role;
        }
      }
      res.json(body);
    } catch (err: any) {
      const errorInfo = this.handleError(err, res);
      res.status(errorInfo.status).json({ error: errorInfo.message });
    }
  }

  /**
   * Identity Platform password sign-in step 1: verify idToken, send email OTP.
   * Does not issue a CRM session cookie until /auth/mfa/verify succeeds.
   */
  async startIdentitySession(
    req: Request<object, object, { idToken?: string }>,
    res: Response
  ): Promise<void> {
    try {
      const idToken = req.body?.idToken?.trim();
      if (!idToken) {
        res.status(400).json({ error: 'idToken is required' });
        return;
      }

      const claims = await this.identityTokenService.verifyIdToken(idToken);
      if (!claims.email) {
        res.status(401).json({ error: 'Identity token is missing email' });
        return;
      }

      const user = await this.identityTokenService.getUserFromIdToken(idToken);
      if (!isStaffRole(user.role)) {
        res.status(403).json({
          error:
            'Staff access only. This account is not authorized for CRM login.',
        });
        return;
      }

      const challenge = await this.emailMfaService.startChallenge({
        authUid: claims.uid,
        email: claims.email,
        idToken,
      });

      res.status(200).json({
        mfaRequired: true,
        challengeId: challenge.challengeId,
        emailHint: challenge.emailHint,
        expiresInSec: challenge.expiresInSec,
        resendAvailableInSec: challenge.resendAvailableInSec,
      });
    } catch (err: any) {
      logger.error(
        {
          context: 'AuthController.startIdentitySession',
          errName: err instanceof Error ? err.name : typeof err,
          errMessage: err instanceof Error ? err.message : undefined,
        },
        'startIdentitySession failed'
      );
      const error = this.handleError(err, res);
      res.status(error.status).json({ error: error.message });
    }
  }
  async verifyIdentityMfa(
    req: Request<
      object,
      object,
      { challengeId?: string; code?: string; idToken?: string }
    >,
    res: Response
  ): Promise<void> {
    try {
      const challengeId = req.body?.challengeId?.trim();
      const code = req.body?.code?.trim();
      const idToken = req.body?.idToken?.trim();
      if (!challengeId || !code || !idToken) {
        res.status(400).json({
          error: 'challengeId, code, and idToken are required',
        });
        return;
      }

      await this.emailMfaService.verifyChallenge({
        challengeId,
        code,
        idToken,
      });

      // Re-verify IdP token before minting session
      const user = await this.identityTokenService.getUserFromIdToken(idToken);
      if (!isStaffRole(user.role)) {
        res.status(403).json({ error: 'Staff access only' });
        return;
      }
      await attachDisplayProfilePicture(user);

      const sessionCookie =
        await this.identityTokenService.createSessionCookie(idToken);
      setSessionCookie(res, sessionCookie);
      res.status(200).json({
        message: 'Login successful',
        user: user.toJSON(),
      });
    } catch (err: any) {
      const error = this.handleError(err, res);
      res.status(error.status).json({ error: error.message });
    }
  }

  async resendIdentityMfa(
    req: Request<object, object, { challengeId?: string; idToken?: string }>,
    res: Response
  ): Promise<void> {
    try {
      const challengeId = req.body?.challengeId?.trim();
      const idToken = req.body?.idToken?.trim();
      if (!challengeId || !idToken) {
        res.status(400).json({ error: 'challengeId and idToken are required' });
        return;
      }

      const challenge = await this.emailMfaService.resendChallenge({
        challengeId,
        idToken,
      });

      res.status(200).json({
        mfaRequired: true,
        challengeId: challenge.challengeId,
        emailHint: challenge.emailHint,
        expiresInSec: challenge.expiresInSec,
        resendAvailableInSec: challenge.resendAvailableInSec,
      });
    } catch (err: any) {
      const error = this.handleError(err, res);
      res.status(error.status).json({ error: error.message });
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
  async logout(req: Request, res: Response): Promise<void> {
    const token = getSessionToken(req as AuthRequest);
    if (token) {
      try {
        const claims =
          await this.identityTokenService.verifySessionOrIdToken(token);
        await getFirebaseAuth().revokeRefreshTokens(claims.uid);
      } catch (revokeError) {
        logger.warn(
          {
            context: 'AuthController.logout',
            errMessage:
              revokeError instanceof Error ? revokeError.message : undefined,
          },
          'Session revocation skipped'
        );
      }
    }
    clearSessionCookies(res);
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
  async verifyEmail(_req: Request, res: Response): Promise<void> {
    res.status(410).json({
      error:
        'Open the verification link from your email in the browser (do not call this API directly).',
    });
  }

  async sendEmailVerification(req: Request, res: Response): Promise<void> {
    try {
      const token = getSessionToken(req as AuthRequest);
      if (!token) {
        res.status(401).json({
          error: 'No session token provided',
          code: ApiErrorCode.UNAUTHENTICATED,
        });
        return;
      }
      const { firebaseUid } =
        await this.identityTokenService.resolveSessionUser(token);
      await emailVerificationService.sendVerificationEmailForUid(firebaseUid);
      res.status(200).json({
        message:
          'Verification email sent if your inbox is not already verified.',
      });
    } catch (error) {
      const handled = this.handleError(error as Error, res);
      res.status(handled.status).json({ error: handled.message });
    }
  }

  async sendEmailVerificationAfterPasswordSetup(
    req: Request<object, object, { email?: string }>,
    res: Response
  ): Promise<void> {
    try {
      const email = String(req.body?.email || '').trim();
      if (!email) {
        res.status(400).json({ error: 'email is required' });
        return;
      }
      await emailVerificationService.sendVerificationEmailForEmail(email);
      res.status(200).json({
        message:
          'Verification email sent if your inbox is not already verified.',
      });
    } catch (error) {
      const handled = this.handleError(error as Error, res);
      res.status(handled.status).json({ error: handled.message });
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
  async getAllUsers(_req: AuthRequest, res: Response): Promise<void> {
    try {
      // Staff directory lives in Cloud SQL (admins/doulas). Supabase public.users is gone.
      const users = await this.cloudSqlTeamService.listTeamMembers();
      res.status(200).json(users);
    } catch (getAllUsersError) {
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
  async googleAuth(_req: Request, res: Response): Promise<void> {
    res.status(410).json({ error: 'Google sign-in is not enabled' });
  }

  //
  // handleOAuthCallback()
  //
  // Handles OAuth initiatiation with a cookie and user (new if not existing)
  //
  // returns:
  //    none
  //
  async handleOAuthCallback(_req: Request, res: Response): Promise<void> {
    res.redirect(
      `${process.env.FRONTEND_URL}/login?error=` +
        encodeURIComponent('Google sign-in is not enabled')
    );
  }

  //
  // handleToken()
  //
  // Checks that the token is valid and is associated with a user
  //
  // returns:
  //    users => user.toJSON()
  //
  async handleToken(_req: Request, res: Response): Promise<void> {
    res.status(410).json({
      error: 'Legacy access-token sessions are no longer accepted.',
    });
  }

  //
  // requestPasswordReset()
  //
  // Request password reset and sends link to user
  //
  // returns:
  //    None
  //
  async requestPasswordReset(_req: Request, res: Response): Promise<void> {
    res.status(410).json({
      error: 'Password reset is handled by Firebase.',
    });
  }

  //
  // handlePasswordRecovery()
  //
  // Verify session and directs user to password recovery
  //
  // returns:
  //    None
  //
  async handlePasswordRecovery(_req: Request, res: Response): Promise<void> {
    res.redirect(
      `${process.env.FRONTEND_URL}/auth/reset-password?error=${encodeURIComponent(
        'This reset link is no longer accepted. Request a new one.'
      )}`
    );
  }

  //
  // updatePassword()
  //
  // After being verified, allows user to update password
  //
  // returns:
  //    user
  //
  async updatePassword(_req: Request, res: Response): Promise<void> {
    res.status(410).json({
      error: 'Password updates are handled by Firebase.',
    });
  }

  // Helper method to handle errors
  private handleError(
    error: Error,
    res: Response
  ): { status: number; message: string } {
    logger.error(
      {
        ...toSafeProviderError('auth', 'auth_request', error),
        errName: error?.name,
        errMessage:
          error instanceof ValidationError ||
          error instanceof AuthenticationError ||
          error instanceof AuthorizationError ||
          error instanceof NotFoundError ||
          error instanceof ConflictError
            ? error.message
            : undefined,
      },
      'Error handling request'
    );

    if (error instanceof ValidationError) {
      return { status: 400, message: error.message };
    } else if (error instanceof ConflictError) {
      return { status: 409, message: error.message };
    } else if (error instanceof AuthenticationError) {
      if (error.message.includes('temporarily unavailable')) {
        return { status: 503, message: error.message };
      }
      return { status: 401, message: error.message };
    } else if (error instanceof NotFoundError) {
      return { status: 404, message: error.message };
    } else if (error instanceof AuthorizationError) {
      return { status: 403, message: error.message };
    } else {
      // Security bug fix (PR 3): unexpected auth failures must not return raw Error.message.
      return { status: 500, message: 'Internal Server Error' };
    }
  }
}
