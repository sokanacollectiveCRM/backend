import express, { Router } from 'express';
import multer from 'multer';
import { clientController, doulaController } from '../index';
import authMiddleware from '../middleware/authMiddleware';
import authorizeRoles from '../middleware/authorizeRoles';

const doulaRoutes: Router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max for documents
});

// Existing routes
doulaRoutes.get('/',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin', 'doula']),
  (req, res) => clientController.getClients(req, res)
);
doulaRoutes.put('/status',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin', 'doula']),
  (req, res) => clientController.updateClientStatus(req, res)
);

// Document management routes
doulaRoutes.post(
  '/documents',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['doula']),
  upload.single('file'),
  (req, res) => doulaController.uploadDocument(req, res)
);

doulaRoutes.get(
  '/documents',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['doula']),
  (req, res) => doulaController.getMyDocuments(req, res)
);

doulaRoutes.delete(
  '/documents/:documentId',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['doula']),
  (req, res) => doulaController.deleteDocument(req, res)
);

// Client access routes (assigned clients only)
doulaRoutes.get(
  '/clients',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['doula']),
  (req, res) => doulaController.getMyClients(req, res)
);

doulaRoutes.get(
  '/clients/:clientId',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['doula']),
  (req, res) => doulaController.getClientDetails(req, res)
);

// Hours logging routes
doulaRoutes.post(
  '/hours',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['doula']),
  (req, res) => doulaController.logHours(req, res)
);

doulaRoutes.get(
  '/hours',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['doula']),
  (req, res) => doulaController.getMyHours(req, res)
);

// Activity/Notes routes
doulaRoutes.post(
  '/clients/:clientId/activities',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['doula']),
  (req, res) => doulaController.addClientActivity(req, res)
);

doulaRoutes.get(
  '/clients/:clientId/activities',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['doula']),
  (req, res) => doulaController.getClientActivities(req, res)
);

// Profile management routes
doulaRoutes.get(
  '/profile',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['doula']),
  (req, res) => doulaController.getMyProfile(req, res)
);

doulaRoutes.put(
  '/profile',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['doula']),
  (req, res) => doulaController.updateMyProfile(req, res)
);

export default doulaRoutes;
