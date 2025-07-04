import express, { Router } from 'express';
import multer from 'multer';
import { contractController } from '../index';
import authMiddleware from '../middleware/authMiddleware';
import authorizeRoles from '../middleware/authorizeRoles';


const clientRoutes: Router = express.Router();

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
 });
 
// generate a contract for a client given a template
clientRoutes.post('/',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin']),
  (req, res) => contractController.generateContract(req, res)
)

// get a preview of an already generated contract
clientRoutes.get('/:id/preview',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin', 'doula', 'client']),
  (req, res) => contractController.previewContract(req, res)
)

// get the list of templates
clientRoutes.get('/templates',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['doula', 'admin']),
  (req, res) => contractController.getAllTemplates(req, res),
)

// delete a template
clientRoutes.delete('/templates/:name',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin']),
  (req, res) => contractController.deleteTemplate(req, res),
)

// update a template
clientRoutes.put('/templates/:name',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin']),
  upload.single('contract'),
  (req, res) => contractController.updateTemplate(req, res),
)

// upload a template
clientRoutes.post('/templates', 
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin']), 
  upload.single('contract'),
  (req, res) => contractController.uploadTemplate(req, res)
);

// request a filled template
clientRoutes.post('/templates/generate',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin']),
  (req, res) => contractController.generateTemplate(req, res),
)


export default clientRoutes;
