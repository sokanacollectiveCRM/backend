import express, { Router } from 'express';
import { clientController } from 'index';
import authMiddleware from 'middleware/authMiddleware';
import authorizeRoles from 'middleware/authorizeRoles';

const clientRoutes: Router = express.Router();

// Signup route
clientRoutes.get('/', authMiddleware, (req, res, next) => authorizeRoles(req, res, next, ['admin', 'doula']), (req, res) => clientController.getClients(req, res));


export default clientRoutes;
