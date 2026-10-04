import {
  ComputeAndPersistOptions,
  InviteEligibility,
  OnboardingGateSnapshot,
  PortalEligibilityDeps,
  PortalEligibilitySnapshot,
  checkInviteEligibility,
  computeAndPersistPortalEligibility,
  getCachedPortalEligibilityBatch,
  loadOnboardingGates,
} from '../features/portal';
import { createPortalEligibilityDeps } from '../features/portal/composition';

export type { InviteEligibility, OnboardingGateSnapshot };

/** Legacy façade over the portal feature. Callers keep this import path. */
export class PortalEligibilityService {
  private readonly deps: PortalEligibilityDeps;

  constructor(deps?: PortalEligibilityDeps) {
    this.deps = deps ?? createPortalEligibilityDeps();
  }

  getOnboardingGates(clientId: string): Promise<OnboardingGateSnapshot> {
    return loadOnboardingGates(this.deps, clientId);
  }

  computeAndPersist(
    clientId: string,
    options?: ComputeAndPersistOptions
  ): Promise<PortalEligibilitySnapshot> {
    return computeAndPersistPortalEligibility(this.deps, clientId, options);
  }

  getPortalEligibility(clientId: string): Promise<PortalEligibilitySnapshot> {
    return this.computeAndPersist(clientId);
  }

  getPortalEligibilityBatch(
    clientIds: string[]
  ): Promise<Map<string, PortalEligibilitySnapshot>> {
    return getCachedPortalEligibilityBatch(this.deps, clientIds);
  }

  getInviteEligibility(clientId: string): Promise<InviteEligibility> {
    return checkInviteEligibility(this.deps, clientId);
  }
}

export const portalEligibilityService = new PortalEligibilityService();
