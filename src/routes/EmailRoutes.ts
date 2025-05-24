import express, { Router } from 'express';
import { emailController } from '../index';
import authMiddleware from '../middleware/authMiddleware';

const emailRoutes: Router = express.Router();

// Protect all email routes with authentication
emailRoutes.use(authMiddleware);

// Route for sending client approval emails
emailRoutes.post('/client-approval', (req, res) => 
  emailController.sendClientApproval(req, res)
);

export default emailRoutes;