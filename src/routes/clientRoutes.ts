import express, { Router } from 'express';
import { clientController } from 'index';
import authMiddleware from 'middleware/authMiddleware';
import authorizeRoles from 'middleware/authorizeRoles';

const clientRoutes: Router = express.Router();

clientRoutes.get('/', 
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin', 'doula']), 
  (req, res) => clientController.getClients(req, res)
);

clientRoutes.put('/status', 
  authMiddleware, 
  (req, res, next) => authorizeRoles(req, res, next, ['admin', 'doula']), 
  (req, res) => clientController.updateClientStatus(req, res)
);



export default clientRoutes;
