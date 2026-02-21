import express, { Router } from 'express';
import { AdminController } from '../controllers/adminController';
import { PortalController } from '../controllers/portalController';
import authMiddleware from '../middleware/authMiddleware';
import authorizeRoles from '../middleware/authorizeRoles';
import { userRepository, clientRepository, assignmentRepository } from '../index';
import { PortalInviteService } from '../services/portalInviteService';
import supabase from '../supabase';

const adminRoutes: Router = express.Router();
const adminController = new AdminController(userRepository, clientRepository, assignmentRepository);

// Portal invite service and controller
const portalInviteService = new PortalInviteService(supabase);
const portalController = new PortalController(portalInviteService);

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

// Portal invite routes
adminRoutes.post(
  '/clients/:id/portal/invite',
  (req, res, next) => authorizeRoles(req, res, next, ['admin']),
  (req, res) => portalController.inviteClient(req, res)
);

adminRoutes.post(
  '/clients/:id/portal/resend',
  (req, res, next) => authorizeRoles(req, res, next, ['admin']),
  (req, res) => portalController.resendInvite(req, res)
);

adminRoutes.post(
  '/clients/:id/portal/disable',
  (req, res, next) => authorizeRoles(req, res, next, ['admin']),
  (req, res) => portalController.disableAccess(req, res)
);

export default adminRoutes;
