import { NextFunction, Request, Response } from 'express';

import { findIntakeTenantBySlug } from '../infrastructure/publicIntakeBrandingRepository';
import type { IntakeRequest } from './intakeRequestTypes';

export async function resolveIntakeTenantSlug(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenantSlug = req.params.tenantSlug?.trim();
    if (!tenantSlug) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    const found = await findIntakeTenantBySlug(tenantSlug);
    if (!found) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    (req as Request & IntakeRequest).intakeTenant = found.write;
    next();
  } catch (error) {
    console.error('resolveIntakeTenantSlug failed:', error);
    res.status(500).json({ error: 'Unable to resolve organization' });
  }
}
