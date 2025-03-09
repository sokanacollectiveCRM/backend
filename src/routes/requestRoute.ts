import { RequestApprovalController } from 'controllers/RequestApprovalController';
import { RequestFormController } from 'controllers/RequestFormController';
import express, { Router } from 'express';
import authMiddleware from '../middleware/authMiddleware';

const requestRouter: Router = express.Router();
const requestFormController = new RequestFormController();
const requestApprovalController = new RequestApprovalController();

requestRouter.post('/requestSubmission', (req, res) => 
  requestFormController.createForm(req, res)  
);

// Admin routes - protected by auth middleware
requestRouter.get('/pending', authMiddleware, (req, res) => 
  requestApprovalController.getPendingRequests(req, res)
);

requestRouter.post('/approve/:requestId', authMiddleware, (req, res) => 
  requestApprovalController.approveRequest(req, res)
);

export default requestRouter;
