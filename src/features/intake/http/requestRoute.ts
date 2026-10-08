import express, { Router } from 'express';

import { requestFormController } from '../../../index';
import { protectPublicIntakeEarly } from '../infrastructure/intakeAbuseProtection';
import { attachLegacySokanaIntakeTenant } from './attachLegacySokanaIntakeTenant';
import { resolveIntakeTenantSlug } from './resolveIntakeTenantSlug';

const requestRouter: Router = express.Router();

requestRouter.get('/public/:tenantSlug', (req, res) =>
  requestFormController.getPublicBranding(req, res)
);

requestRouter.post(
  '/:tenantSlug/requestSubmission',
  resolveIntakeTenantSlug,
  protectPublicIntakeEarly,
  (req, res) => requestFormController.createForm(req, res)
);

requestRouter.post(
  '/requestSubmission',
  attachLegacySokanaIntakeTenant,
  protectPublicIntakeEarly,
  (req, res) => requestFormController.createForm(req, res)
);

export default requestRouter;
