import express, { Router } from 'express';
import multer from 'multer';
import { userController } from '../index';
import authMiddleware from '../middleware/authMiddleware';

const userRoutes: Router = express.Router();

// route for retrieving specific user's information
userRoutes.get('/:id', authMiddleware, (req, res) => userController.getUserById(req, res));

userRoutes.get('/:id/hours', authMiddleware, (req, res) => userController.getHours(req, res));

userRoutes.post('/:id/addhours', authMiddleware, (req, res) => userController.addNewHours(req, res));

// uploading a profile picture requires multer
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
 });
userRoutes.put('/update', authMiddleware, upload.single('profile_picture'), (req, res) => userController.updateUser(req, res));

export default userRoutes;