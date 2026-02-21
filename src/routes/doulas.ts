import express, { Router } from 'express';
import { DoulasController } from '../controllers/doulasController';
import authMiddleware from '../middleware/authMiddleware';
import authorizeRoles from '../middleware/authorizeRoles';
import { DoulasService } from '../services/doulasService';

const router: Router = express.Router();
const controller = new DoulasController(new DoulasService());

router.use(authMiddleware);
router.use((req, res, next) => authorizeRoles(req, res, next, ['admin']));

router.get('/doulas', (req, res) => controller.listDoulas(req, res));
router.get('/doula-assignments', (req, res) => controller.listDoulaAssignments(req, res));
router.get('/doula-assignments/:clientId/:doulaId', (req, res) =>
  controller.getDoulaAssignment(req, res)
);
router.patch('/doula-assignments/:clientId/:doulaId', (req, res) =>
  controller.updateDoulaAssignment(req, res)
);
router.get('/clients/:clientId/doula-assignments', (req, res) => controller.listClientDoulaAssignments(req, res));

export default router;

