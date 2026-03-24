import express, { Router } from 'express';
import multer from 'multer';
import { clientController, userController } from '../index';
import { PortalController } from '../controllers/portalController';
import { PortalInviteService } from '../services/portalInviteService';
import supabase from '../supabase';
import authMiddleware from '../middleware/authMiddleware';
import authorizeRoles from '../middleware/authorizeRoles';

const clientRoutes: Router = express.Router();
const clientDocumentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Portal controller for client portal endpoints
const portalInviteService = new PortalInviteService(supabase);
const portalController = new PortalController(portalInviteService);

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

clientRoutes.post('/me/documents',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['client']),
  clientDocumentUpload.single('file'),
  (req, res) => clientController.uploadMyDocument(req, res)
);

clientRoutes.get('/me/documents',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['client']),
  (req, res) => clientController.getMyDocuments(req, res)
);

clientRoutes.get('/me/documents/:documentId/url',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['client']),
  (req, res) => clientController.getMyDocumentUrl(req, res)
);

clientRoutes.delete('/me/documents/:documentId',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['client']),
  (req, res) => clientController.deleteMyDocument(req, res)
);

clientRoutes.get('/:clientId/documents',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin', 'doula']),
  (req, res) => clientController.getClientDocuments(req, res)
);

clientRoutes.get('/:clientId/documents/:documentId/url',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin', 'doula']),
  (req, res) => clientController.getClientDocumentUrl(req, res)
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

// PHI-specific route (must come before generic /:id)
clientRoutes.put('/:id/phi',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin', 'doula']),
  (req, res) => clientController.updateClientPhi(req, res)
);

clientRoutes.get('/me/billing',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['client']),
  (req, res) => clientController.getClientBilling(req, res)
);

clientRoutes.put('/me/billing',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['client']),
  (req, res) => clientController.updateClientBilling(req, res)
);

clientRoutes.get('/:id/billing',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin', 'doula']),
  (req, res) => clientController.getClientBilling(req, res)
);

clientRoutes.put('/:id/billing',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin', 'doula']),
  (req, res) => clientController.updateClientBilling(req, res)
);

// Generic routes last
clientRoutes.get('/:id',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin', 'doula', 'client']),
  (req, res) => clientController.getClientById(req, res)
);

clientRoutes.put('/:id',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin', 'doula', 'client']),
  (req, res) => clientController.updateClient(req, res)
);

// PATCH alias — same handler, proper REST semantics for partial updates
clientRoutes.patch('/:id',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin', 'doula', 'client']),
  (req, res) => clientController.updateClient(req, res)
);

// Activity/Notes routes
clientRoutes.get('/:id/activities',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin', 'doula', 'client']),
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
  (req, res, next) => authorizeRoles(req, res, next, ['admin', 'doula', 'client']),
  (req, res) => clientController.getAssignedDoulas(req, res)
);

// Portal status endpoint for authenticated clients
clientRoutes.get('/me/portal-status',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['client']),
  (req, res) => portalController.getMyPortalStatus(req, res)
);

export default clientRoutes;
