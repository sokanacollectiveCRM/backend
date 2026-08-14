import express, { Router } from 'express';

import { emailController } from '../index';
import authMiddleware from '../middleware/authMiddleware';
import authorizeRoles from '../middleware/authorizeRoles';

const emailRoutes: Router = express.Router();

// Protect all email routes with authentication
emailRoutes.use(authMiddleware);
emailRoutes.use((req, res, next) => authorizeRoles(req, res, next, ['admin']));

// Route for sending client approval emails
emailRoutes.post('/client-approval', (req, res) =>
  emailController.sendClientApproval(req, res)
);

// Route for sending team invite emails
emailRoutes.post('/team-invite', (req, res) =>
  emailController.sendTeamInvite(req, res)
);

export default emailRoutes;
