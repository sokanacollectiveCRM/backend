import express, { Router } from 'express';
import { requestFormController } from '../index';

const requestRouter: Router =  express.Router();

requestRouter.post('/requestSubmission', 
  (req, res) => requestFormController.createForm(req, res));

export default requestRouter;
