import express, { Router } from 'express';
import multer from 'multer';

import { requestFormController } from '../../../index';
import { storeIntakeAnswerImage } from '../application/intakeFormEditor';
import {
  getIntakeAbuseStore,
  protectPublicIntakeEarly,
} from '../infrastructure/intakeAbuseProtection';
import { attachLegacySokanaIntakeTenant } from './attachLegacySokanaIntakeTenant';
import type { IntakeRequest } from './intakeRequestTypes';
import { resolveIntakeTenantSlug } from './resolveIntakeTenantSlug';

const answerImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const requestRouter: Router = express.Router();

requestRouter.get('/public/:tenantSlug', (req, res) =>
  requestFormController.getPublicBranding(req, res)
);

requestRouter.post(
  '/:tenantSlug/intake-images',
  resolveIntakeTenantSlug,
  (req, res) => {
    answerImageUpload.single('image')(req, res, async (uploadError) => {
      if (uploadError) {
        res.status(400).json({ error: 'Each image must be 5 MB or smaller.' });
        return;
      }
      try {
        const tenant = (req as express.Request & IntakeRequest).intakeTenant;
        if (!tenant) {
          res.status(404).json({ error: 'Organization not found' });
          return;
        }
        const ip = req.ip || req.socket.remoteAddress || 'unknown';
        const limit = await getIntakeAbuseStore().hitRateLimit(
          `intake-image:${tenant.tenantId}:${ip}`,
          20,
          60 * 60 * 1000
        );
        if (limit.allowed === false) {
          res.setHeader('Retry-After', String(limit.retryAfterSec));
          res.status(429).json({
            error: 'Too many image uploads. Try again later.',
            code: 'RATE_LIMITED',
            retryAfterSec: limit.retryAfterSec,
          });
          return;
        }
        const file = (
          req as express.Request & {
            file?: { buffer: Buffer; mimetype: string; size: number };
          }
        ).file;
        const assetId = await storeIntakeAnswerImage({
          tenantId: tenant.tenantId,
          file: file
            ? { buffer: file.buffer, mimetype: file.mimetype, size: file.size }
            : undefined,
          createdBy: 'public',
        });
        res.status(200).json({ assetId });
      } catch (error) {
        const status =
          error && typeof error === 'object' && 'status' in error
            ? Number((error as { status: number }).status)
            : 500;
        const message =
          error instanceof Error ? error.message : 'Upload failed.';
        res
          .status(status >= 400 && status < 600 ? status : 500)
          .json({ error: message });
      }
    });
  }
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
