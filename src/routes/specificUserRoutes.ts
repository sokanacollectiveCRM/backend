import express, { Router } from 'express';
import authMiddleware from 'middleware/authMiddleware';
import { userController } from 'index';

const userRoutes: Router = express.Router();

// route for retrieving specific user's information
userRoutes.get('/:id', authMiddleware, (req, res) => userController.getUserById(req, res));

export default userRoutes;