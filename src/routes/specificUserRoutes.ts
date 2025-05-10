import express, { Router } from 'express';
import { userController } from 'index';
import authMiddleware from 'middleware/authMiddleware';
import multer from 'multer';

const userRoutes: Router = express.Router();

// route for retrieving specific user's information
userRoutes.get('/:id', authMiddleware, (req, res) => userController.getUserById(req, res));

userRoutes.get('/:id/hours', authMiddleware, (req, res) => userController.getHoursById(req, res));

userRoutes.put('/:id/hours', authMiddleware, (req, res) => userController.addNewHours(req, res));

// uploading a profile picture requires multer
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
 });
userRoutes.put('/update', authMiddleware, upload.single('profile_picture'), (req, res) => userController.updateUser(req, res));

export default userRoutes;