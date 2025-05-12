import express, { Router } from 'express';
import { contractController } from 'index';
import authMiddleware from 'middleware/authMiddleware';
import authorizeRoles from 'middleware/authorizeRoles';
import multer from 'multer';


const clientRoutes: Router = express.Router();

// upload a template
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
 });
clientRoutes.post('/', 
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin']), 
  upload.single('contract'),
  (req, res) => contractController.uploadTemplate(req, res)
);

// request a filled template
clientRoutes.post('/generate',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin']),
  (req, res) => contractController.generateTemplate(req, res),
)



export default clientRoutes;
