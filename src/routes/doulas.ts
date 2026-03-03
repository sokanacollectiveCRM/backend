import express, { Router } from 'express';
import { DoulasController } from '../controllers/doulasController';
import authMiddleware from '../middleware/authMiddleware';
import authorizeRoles from '../middleware/authorizeRoles';
import { DoulasService } from '../services/doulasService';

const router: Router = express.Router();
const controller = new DoulasController(new DoulasService());

router.get('/doulas',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin']),
  (req, res) => controller.listDoulas(req, res)
);
router.get('/doula-assignments',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin']),
  (req, res) => controller.listDoulaAssignments(req, res)
);
router.get('/doula-assignments/:clientId/:doulaId',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin']),
  (req, res) =>
  controller.getDoulaAssignment(req, res)
);
router.patch('/doula-assignments/:clientId/:doulaId',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin']),
  (req, res) =>
  controller.updateDoulaAssignment(req, res)
);
router.get('/clients/:clientId/doula-assignments',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin']),
  (req, res) => controller.listClientDoulaAssignments(req, res)
);

export default router;

