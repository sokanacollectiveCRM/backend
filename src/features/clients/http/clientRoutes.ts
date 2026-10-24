import express, { Router } from 'express';
import multer from 'multer';

import {
  generateInstallmentInvoice,
  getClientPaymentSchedule,
} from '../../../controllers/clientBillingController';
import { PortalController } from '../../../controllers/portalController';
import {
  clientController,
  doulaController,
  userController,
} from '../../../index';
import authMiddleware from '../../../middleware/authMiddleware';
import authorizeRoles from '../../../middleware/authorizeRoles';
import { PortalInviteService } from '../../../services/portalInviteService';
import { AuthRequest } from '../../../types';

const clientRoutes: Router = express.Router();
const clientDocumentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Portal controller for client portal endpoints
const portalInviteService = new PortalInviteService();
const portalController = new PortalController(portalInviteService);

// Team specific routes
clientRoutes.get(
  '/team/all',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin', 'doula']),
  (req, res) => userController.getAllTeamMembers(req, res)
);

clientRoutes.get(
  '/team/doulas',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin']),
  (req, res) => userController.getAllDoulas(req, res)
);

clientRoutes.delete(
  '/team/:id',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin']),
  (req, res) => userController.deleteMember(req, res)
);

clientRoutes.put(
  '/team/:id',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin']),
  clientDocumentUpload.single('certification_files'),
  (req, res) => {
    if ((req as AuthRequest).file) {
      // Legacy admin certification picker uses the same document policy and
      // review lifecycle as the doula portal; the existing admin gate stays above.
      req.body.document_type = 'training_certificate';
      void doulaController.uploadDocument(req, res, req.params.id);
    } else {
      void userController.updateTeamMember(req, res);
    }
  }
);

clientRoutes.post(
  '/team/add',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin']),
  (req, res) => userController.addTeamMember(req, res)
);

// Client specific routes - ORDER MATTERS! Specific routes first
// HIPAA-13A / INV-02: bulk client CSV is admin-only until leadership expands roles.
clientRoutes.get(
  '/fetchCSV',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin']),
  (req, res) => clientController.exportCSV(req, res)
);

clientRoutes.get(
  '/',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin', 'doula']),
  (req, res) => clientController.getClients(req, res)
);

clientRoutes.post(
  '/me/documents',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['client']),
  clientDocumentUpload.single('file'),
  (req, res) => clientController.uploadMyDocument(req, res)
);

clientRoutes.get(
  '/me/documents',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['client']),
  (req, res) => clientController.getMyDocuments(req, res)
);

clientRoutes.get(
  '/me/documents/:documentId/url',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['client']),
  (req, res) => clientController.getMyDocumentUrl(req, res)
);

clientRoutes.delete(
  '/me/documents/:documentId',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['client']),
  (req, res) => clientController.deleteMyDocument(req, res)
);

clientRoutes.get(
  '/:clientId/documents',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin', 'doula']),
  (req, res) => clientController.getClientDocuments(req, res)
);

clientRoutes.get(
  '/:clientId/documents/:documentId/url',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin', 'doula']),
  (req, res) => clientController.getClientDocumentUrl(req, res)
);

// Specific routes must come before generic /:id route
clientRoutes.put(
  '/status',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin', 'doula']),
  (req, res) => clientController.updateClientStatus(req, res)
);

clientRoutes.delete(
  '/delete',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin']),
  (req, res) => clientController.deleteClient(req, res)
);

// PHI-specific route (must come before generic /:id)
clientRoutes.put(
  '/:id/phi',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin', 'doula']),
  (req, res) => clientController.updateClientPhi(req, res)
);

// Structured Birth Outcomes (must come before generic /:id)
clientRoutes.put(
  '/:id/birth-outcomes',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin', 'doula']),
  (req, res) => clientController.updateClientBirthOutcomes(req, res)
);

clientRoutes.get(
  '/:clientId/billing/payment-schedule',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin', 'billing']),
  (req, res) => getClientPaymentSchedule(req, res)
);

clientRoutes.post(
  '/:clientId/billing/installments/:installmentId/invoice',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin', 'billing']),
  (req, res) => generateInstallmentInvoice(req, res)
);

clientRoutes.get(
  '/me/billing',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['client']),
  (req, res) => clientController.getClientBilling(req, res)
);

clientRoutes.put(
  '/me/billing',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['client']),
  (req, res) => clientController.updateClientBilling(req, res)
);

clientRoutes.get(
  '/:id/billing',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin', 'billing']),
  (req, res) => clientController.getClientBilling(req, res)
);

clientRoutes.put(
  '/:id/billing',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin', 'billing']),
  (req, res) => clientController.updateClientBilling(req, res)
);

// Generic routes last
clientRoutes.get(
  '/:id',
  authMiddleware,
  (req, res, next) =>
    authorizeRoles(req, res, next, ['admin', 'doula', 'client']),
  (req, res) => clientController.getClientById(req, res)
);

clientRoutes.put(
  '/:id',
  authMiddleware,
  (req, res, next) =>
    authorizeRoles(req, res, next, ['admin', 'doula', 'client']),
  (req, res) => clientController.updateClient(req, res)
);

// PATCH alias — same handler, proper REST semantics for partial updates
clientRoutes.patch(
  '/:id',
  authMiddleware,
  (req, res, next) =>
    authorizeRoles(req, res, next, ['admin', 'doula', 'client']),
  (req, res) => clientController.updateClient(req, res)
);

// Activity/Notes routes
clientRoutes.get(
  '/:id/activities',
  authMiddleware,
  (req, res, next) =>
    authorizeRoles(req, res, next, ['admin', 'doula', 'client']),
  (req, res) => clientController.getClientActivities(req, res)
);

clientRoutes.post(
  '/:id/activity',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin', 'doula']),
  (req, res) => clientController.createActivity(req, res)
);

// Doula assignment routes
clientRoutes.post(
  '/:id/assign-doula',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin']),
  (req, res) => clientController.assignDoula(req, res)
);

clientRoutes.delete(
  '/:id/assign-doula/:doulaId',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin']),
  (req, res) => clientController.unassignDoula(req, res)
);

clientRoutes.get(
  '/:id/assigned-doulas',
  authMiddleware,
  (req, res, next) =>
    authorizeRoles(req, res, next, ['admin', 'doula', 'client']),
  (req, res) => clientController.getAssignedDoulas(req, res)
);

clientRoutes.post(
  '/:id/assigned-doulas/:doulaId/booking-requests',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin', 'client']),
  (req, res) => clientController.createDoulaBookingRequest(req, res)
);

// Portal status endpoint for authenticated clients
clientRoutes.get(
  '/me/portal-status',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['client']),
  (req, res) => portalController.getMyPortalStatus(req, res)
);

export default clientRoutes;
