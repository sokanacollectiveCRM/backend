import express, { Router } from 'express';
import { clientController } from 'index';
import authMiddleware from 'middleware/authMiddleware';

const clientRoutes: Router = express.Router();

// Signup route
clientRoutes.get('/', authMiddleware, (req, res) => clientController.getClients(req, res));


export default clientRoutes;
