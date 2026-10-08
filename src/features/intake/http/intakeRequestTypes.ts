import type { IntakeTenantWriteContext } from '../infrastructure/publicIntakeBrandingRepository';

export type IntakeRequest = {
  intakeTenant?: IntakeTenantWriteContext;
};
