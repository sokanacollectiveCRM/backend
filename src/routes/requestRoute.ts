import express, { Router } from 'express';
import authMiddleware from '../middleware/authMiddleware';
import { RequestFormController } from 'controllers/RequestFormController';

const requestRouter: Router =  express.Router();
const requestFormController = new RequestFormController();

requestRouter.post('/requestSubmission', (req, res) => 
  requestFormController.createForm(req, res)  
);
export default requestRouter;
