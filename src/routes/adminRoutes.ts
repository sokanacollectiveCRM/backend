import express, { Router } from 'express';
import authMiddleware from '../middleware/authMiddleware';
import { RequestApprovalController } from '../controllers/RequestApprovalController';

const adminRouter: Router = express.Router();
const requestApprovalController = new RequestApprovalController();

adminRouter.get('/dashboard', authMiddleware, (req, res) => {
  res.status(200).json({ message: "Admin dashboard data" });
});

adminRouter.get('/requests/pending', authMiddleware, (req, res) => 
  requestApprovalController.getPendingRequests(req, res)
);

adminRouter.post('/requests/approve/:requestId', authMiddleware, (req, res) => 
  requestApprovalController.approveRequest(req, res)
);

export default adminRouter;