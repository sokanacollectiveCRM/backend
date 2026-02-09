import express, { Router } from 'express';
import { clientController, userController } from '../index';
import { PortalController } from '../controllers/portalController';
import { PortalInviteService } from '../services/portalInviteService';
import supabase from '../supabase';
import { clientRepository } from '../index';
import authMiddleware from '../middleware/authMiddleware';
import authorizeRoles from '../middleware/authorizeRoles';

const clientRoutes: Router = express.Router();

// Portal controller for client portal endpoints
const portalInviteService = new PortalInviteService(supabase);
const portalController = new PortalController(portalInviteService, clientRepository);

// Team specific routes
clientRoutes.get('/team/all',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin', 'doula']),
  (req, res) => userController.getAllTeamMembers(req, res)
);

clientRoutes.get('/team/doulas',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin']),
  (req, res) => userController.getAllDoulas(req, res)
);

clientRoutes.delete('/team/:id',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin']),
  (req, res) => userController.deleteMember(req, res)
);

clientRoutes.put('/team/:id',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin']),
  (req, res) => userController.updateTeamMember(req, res)
);

clientRoutes.post("/team/add",
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin']),
  (req, res) => userController.addTeamMember(req, res)
);

// Client specific routes - ORDER MATTERS! Specific routes first
clientRoutes.get('/fetchCSV',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin','client']),
  (req, res) => clientController.exportCSV(req, res)
);

clientRoutes.get('/',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin', 'doula']),
  (req, res) => clientController.getClients(req, res)
);

// Specific routes must come before generic /:id route
clientRoutes.put('/status',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin', 'doula']),
  (req, res) => clientController.updateClientStatus(req, res)
);

clientRoutes.delete('/delete',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin']),
  (req, res) => clientController.deleteClient(req, res)
);

// Generic routes last
clientRoutes.get('/:id',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin', 'doula', 'client']),
  (req, res) => clientController.getClientById(req, res)
);

clientRoutes.put('/:id',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin', 'doula']),
  (req, res) => clientController.updateClient(req, res)
);

// PATCH alias — same handler, proper REST semantics for partial updates
clientRoutes.patch('/:id',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin', 'doula']),
  (req, res) => clientController.updateClient(req, res)
);

// Activity/Notes routes
clientRoutes.get('/:id/activities',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin', 'doula']),
  (req, res) => clientController.getClientActivities(req, res)
);

clientRoutes.post('/:id/activity',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin', 'doula']),
  (req, res) => clientController.createActivity(req, res)
);

// Doula assignment routes
clientRoutes.post('/:id/assign-doula',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin']),
  (req, res) => clientController.assignDoula(req, res)
);

clientRoutes.delete('/:id/assign-doula/:doulaId',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin']),
  (req, res) => clientController.unassignDoula(req, res)
);

clientRoutes.get('/:id/assigned-doulas',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin', 'doula']),
  (req, res) => clientController.getAssignedDoulas(req, res)
);

// Portal status endpoint for authenticated clients
clientRoutes.get('/me/portal-status',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['client']),
  (req, res) => portalController.getMyPortalStatus(req, res)
);

export default clientRoutes;
