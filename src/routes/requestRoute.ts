import express, { Router } from 'express';
import { requestFormController } from '../index';
import { protectPublicIntakeEarly } from '../features/intake/infrastructure/intakeAbuseProtection';

const requestRouter: Router = express.Router();

// Public intake — honeypot + IP rate limit before controller (P0 abuse protection).
requestRouter.post(
  '/requestSubmission',
  protectPublicIntakeEarly,
  (req, res) => requestFormController.createForm(req, res),
);

export default requestRouter;
