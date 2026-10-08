import { NextFunction, Request, Response } from 'express';

import { SOKANA_TENANT_SLUG } from '../../tenancy';
import { findIntakeTenantBySlug } from '../infrastructure/publicIntakeBrandingRepository';
import type { IntakeRequest } from './intakeRequestTypes';

/** Legacy `POST /requestService/requestSubmission` → Sokana360 tenant context. */
export async function attachLegacySokanaIntakeTenant(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const found = await findIntakeTenantBySlug(SOKANA_TENANT_SLUG);
    if (!found) {
      res.status(503).json({ error: 'Intake is temporarily unavailable' });
      return;
    }
    (req as Request & IntakeRequest).intakeTenant = found.write;
    req.params.tenantSlug = SOKANA_TENANT_SLUG;
    next();
  } catch (error) {
    console.error('attachLegacySokanaIntakeTenant failed:', error);
    res.status(500).json({ error: 'Unable to resolve organization' });
  }
}
