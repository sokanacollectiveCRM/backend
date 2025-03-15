import express, { Router } from 'express';
import { authController } from 'index';
import authMiddleware from 'middleware/authMiddleware';


const authRoutes: Router = express.Router();

// Signup route
authRoutes.post('/signup', (req, res) => authController.signup(req, res));

// Login route
authRoutes.post('/login', (req, res) => authController.login(req, res));

// Get current user route
authRoutes.get('/me', (req, res) => authController.getMe(req, res));

// Get all users route
authRoutes.get('/users', authMiddleware, (req, res) => authController.getAllUsers(req, res));

// Logout route
authRoutes.post('/logout', (req, res) => authController.logout(req, res));

// Email verification route
authRoutes.get('/verify', (req, res) => authController.verifyEmail(req, res));

// Google OAuth routes
authRoutes.get('/google', (req, res) => authController.googleAuth(req, res));
authRoutes.get('/callback', (req, res) => authController.handleOAuthCallback(req, res));
authRoutes.post('/callback', (req, res) => authController.handleToken(req, res));

// Password reset routes
authRoutes.post('/reset-password', (req, res) => authController.requestPasswordReset(req, res));
authRoutes.get('/password-recovery', (req, res) => authController.handlePasswordRecovery(req, res));
authRoutes.put('/update-password', (req, res) => authController.updatePassword(req, res));

export default authRoutes;
