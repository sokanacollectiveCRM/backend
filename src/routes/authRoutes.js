'use strict';
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
const express_1 = __importDefault(require('express'));
const index_1 = require('../index');
const authMiddleware_1 = __importDefault(
  require('../middleware/authMiddleware')
);
const authRoutes = express_1.default.Router();
// Signup route
authRoutes.post('/signup', (req, res) =>
  index_1.authController.signup(req, res)
);
// Login route
authRoutes.post('/login', (req, res) => index_1.authController.login(req, res));
// Get current user route
authRoutes.get('/me', (req, res) => index_1.authController.getMe(req, res));
// Get all users route
authRoutes.get('/users', authMiddleware_1.default, (req, res) =>
  index_1.authController.getAllUsers(req, res)
);
// Logout route
authRoutes.post('/logout', (req, res) =>
  index_1.authController.logout(req, res)
);
// Email verification route
authRoutes.get('/verify', (req, res) =>
  index_1.authController.verifyEmail(req, res)
);
// Google OAuth routes
authRoutes.get('/google', (req, res) =>
  index_1.authController.googleAuth(req, res)
);
authRoutes.get('/callback', (req, res) =>
  index_1.authController.handleOAuthCallback(req, res)
);
authRoutes.post('/callback', (req, res) =>
  index_1.authController.handleToken(req, res)
);
// Password reset routes
authRoutes.post('/reset-password', (req, res) =>
  index_1.authController.requestPasswordReset(req, res)
);
authRoutes.get('/password-recovery', (req, res) =>
  index_1.authController.handlePasswordRecovery(req, res)
);
authRoutes.put('/reset-password', (req, res) =>
  index_1.authController.updatePassword(req, res)
);
exports.default = authRoutes;
