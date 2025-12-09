import express, { Router } from 'express';
import { AdminController } from '../controllers/adminController';
import authMiddleware from '../middleware/authMiddleware';
import authorizeRoles from '../middleware/authorizeRoles';
import { userRepository, clientRepository, assignmentRepository } from '../index';

const adminRoutes: Router = express.Router();
const adminController = new AdminController(userRepository, clientRepository, assignmentRepository);

// All admin routes require authentication and admin role
adminRoutes.use(authMiddleware);

// Invite doula endpoint
adminRoutes.post(
  '/doulas/invite',
  (req, res, next) => authorizeRoles(req, res, next, ['admin']),
  (req, res) => adminController.inviteDoula(req, res)
);

// Get clients in matching phase
adminRoutes.get(
  '/clients/matching',
  (req, res, next) => authorizeRoles(req, res, next, ['admin']),
  (req, res) => adminController.getMatchingClients(req, res)
);

// Match doula with client (only clients in matching phase)
adminRoutes.post(
  '/assignments/match',
  (req, res, next) => authorizeRoles(req, res, next, ['admin']),
  (req, res) => adminController.matchDoulaWithClient(req, res)
);

export default adminRoutes;
