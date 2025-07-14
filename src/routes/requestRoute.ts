import express, { Router } from 'express';
import { requestFormController } from '../index';

const requestRouter: Router = express.Router();

// Updated endpoint to handle all 10-step form fields
requestRouter.post('/requestSubmission', 
  (req, res) => requestFormController.createForm(req, res));

export default requestRouter;
