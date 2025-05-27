import express, { Router } from 'express';
import { clientController,userController } from '../index';
import authMiddleware from '../middleware/authMiddleware';
import authorizeRoles from '../middleware/authorizeRoles';

const clientRoutes: Router = express.Router();

// Team specific routes
clientRoutes.get('/team/all',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin', 'doula']),
  (req, res) => userController.getAllTeamMembers(req, res)
);

clientRoutes.delete('/team/:id',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin']),
  (req, res) => userController.deleteMember(req, res)
);

clientRoutes.post("/team/add",
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin']),
  (req, res) => userController.addTeamMember(req, res)
);

// Client specific routes
clientRoutes.get('/fetchCSV', 
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin','client']), 
  (req, res) => clientController.getCSVClients(req, res)
);

clientRoutes.get('/', 
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin', 'doula']), 
  (req, res) => clientController.getClients(req, res)
);

clientRoutes.get('/:id',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin', 'doula', 'client']),
  (req, res) => clientController.getClientById(req, res)
);

clientRoutes.put('/status',
  authMiddleware, 
  (req, res, next) => authorizeRoles(req, res, next, ['admin', 'doula']), 
  (req, res) => clientController.updateClientStatus(req, res)
);

export default clientRoutes;
