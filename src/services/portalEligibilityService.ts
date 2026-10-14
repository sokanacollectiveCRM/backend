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
import { maybeAutoInviteFamily } from '../features/portal/application/maybeAutoInviteFamily';
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

  async computeAndPersist(
    clientId: string,
    options?: ComputeAndPersistOptions
  ): Promise<PortalEligibilitySnapshot> {
    const snapshot = await computeAndPersistPortalEligibility(
      this.deps,
      clientId,
      options
    );
    await maybeAutoInviteFamily(clientId, snapshot);
    return snapshot;
  }

  getPortalEligibility(clientId: string): Promise<PortalEligibilitySnapshot> {
    // Reading portal readiness must not send invitations. Event recomputations use computeAndPersist.
    return computeAndPersistPortalEligibility(this.deps, clientId);
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
