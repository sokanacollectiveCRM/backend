import express, { Router } from 'express';
import { EmailController } from '../controllers/emailController';
import authMiddleware from '../middleware/authMiddleware';

const emailController = new EmailController();
const emailRoutes: Router = express.Router();

// Protect all email routes with authentication
emailRoutes.use(authMiddleware);

// Route for sending client approval emails
emailRoutes.post('/client-approval', (req, res) => 
  emailController.sendClientApproval(req, res)
);

// Route for sending team invite emails
emailRoutes.post('/team-invite', (req, res) => 
  emailController.sendTeamInvite(req, res)
);

export default emailRoutes;