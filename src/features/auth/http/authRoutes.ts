import express, { Request, Response, Router } from 'express';

import { NotFoundError, ValidationError } from '../../../domains/errors';
import { authController } from '../../../index';
import authMiddleware from '../../../middleware/authMiddleware';
import { validateBody } from '../../../middleware/validateRequest';
import {
  identityMfaResendBodySchema,
  identityMfaVerifyBodySchema,
  identitySessionBodySchema,
  loginBodySchema,
} from '../../../security/requestSchemas';
import {
  acceptStaffInvitation,
  previewStaffInvitation,
} from '../../team/application/staffInvitationService';

const authRoutes: Router = express.Router();

function invitationError(error: unknown, res: Response): void {
  if (error instanceof NotFoundError) {
    res.status(404).json({ error: error.message });
    return;
  }
  if (error instanceof ValidationError) {
    res.status(400).json({ error: error.message });
    return;
  }
  const message = error instanceof Error ? error.message : 'Invitation failed';
  const lower = message.toLowerCase();
  if (lower.includes('already') || lower.includes('exists')) {
    res.status(409).json({ error: 'This email is already in use.' });
    return;
  }
  res.status(500).json({ error: 'Invitation could not be accepted.' });
}

authRoutes.post('/invitations/preview', async (req: Request, res: Response) => {
  try {
    const preview = await previewStaffInvitation(String(req.body?.token || ''));
    res.json(preview);
  } catch (error) {
    invitationError(error, res);
  }
});

authRoutes.post('/invitations/accept', async (req: Request, res: Response) => {
  try {
    await acceptStaffInvitation({
      token: String(req.body?.token || ''),
      password: String(req.body?.password || ''),
    });
    res.status(200).json({
      message:
        'Invitation accepted. Check your email to verify your address, then log in.',
    });
  } catch (error) {
    invitationError(error, res);
  }
});

// Signup route
authRoutes.post('/signup', (req, res) => authController.signup(req, res));

// Login route — Zod body validation (PR 7); success shape unchanged.
authRoutes.post('/login', validateBody(loginBodySchema), (req, res) =>
  authController.login(req, res)
);

// Identity Platform: password idToken → email OTP → session
authRoutes.post(
  '/session',
  validateBody(identitySessionBodySchema),
  (req, res) => authController.startIdentitySession(req, res)
);
authRoutes.post(
  '/mfa/verify',
  validateBody(identityMfaVerifyBodySchema),
  (req, res) => authController.verifyIdentityMfa(req, res)
);
authRoutes.post(
  '/mfa/resend',
  validateBody(identityMfaResendBodySchema),
  (req, res) => authController.resendIdentityMfa(req, res)
);

// Get current user route
authRoutes.get('/me', (req, res) => authController.getMe(req, res));

// Get all users route
authRoutes.get('/users', authMiddleware, (req, res) =>
  authController.getAllUsers(req, res)
);

// Logout route
authRoutes.post('/logout', (req, res) => authController.logout(req, res));

// Email verification route
authRoutes.get('/verify', (req, res) => authController.verifyEmail(req, res));
authRoutes.post('/send-email-verification', authMiddleware, (req, res) =>
  authController.sendEmailVerification(req, res)
);
authRoutes.post('/email-verification/post-password-setup', (req, res) =>
  authController.sendEmailVerificationAfterPasswordSetup(req, res)
);

// Google OAuth routes
authRoutes.get('/google', (req, res) => authController.googleAuth(req, res));
authRoutes.get('/callback', (req, res) =>
  authController.handleOAuthCallback(req, res)
);
authRoutes.post('/callback', (req, res) =>
  authController.handleToken(req, res)
);

// Password reset routes
authRoutes.post('/reset-password', (req, res) =>
  authController.requestPasswordReset(req, res)
);
authRoutes.get('/password-recovery', (req, res) =>
  authController.handlePasswordRecovery(req, res)
);
authRoutes.put('/reset-password', (req, res) =>
  authController.updatePassword(req, res)
);

export default authRoutes;
