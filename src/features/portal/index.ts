/**
 * Public portal feature API.
 * Cross-feature consumers should import from this barrel only.
 *
 * Infrastructure adapters are wired in `composition.ts`, which is not
 * re-exported here: the readiness repository imports this barrel.
 */

export type {
  OnboardingFactRecord,
  OnboardingFactsReader,
  CardOnFileRecord,
  CardOnFileReader,
  StoredReadiness,
  SaveReadinessInput,
  ReadinessEvent,
  PortalReadinessStore,
  PortalEligibilityDeps,
} from './application/ports';

export {
  loadOnboardingGates,
  computeAndPersistPortalEligibility,
  getCachedPortalEligibilityBatch,
  checkInviteEligibility,
} from './application/portalEligibility';
export type {
  InviteEligibility,
  OnboardingGateSnapshot,
  ComputeAndPersistOptions,
} from './application/portalEligibility';

export {
  PORTAL_BLOCKER_CODES,
  PORTAL_BLOCKER_PRIORITY,
  BILLING_PATHS,
  ONBOARDING_EVENT_TYPES,
  SIGNED_CONTRACT_STATUS,
  DEPOSIT_PAYMENT_TYPE,
  PAID_INSTALLMENT_STATUSES,
  INVITE_BLOCKED_FALLBACK_MESSAGE,
  resolveBillingPath,
  isPaymentAuthorizationRequired,
  isClientDepositRequired,
  computePortalBlockers,
  selectPrimaryPortalBlocker,
  computePortalEligibility,
  computeAllowedActions,
  isPaidInstallmentStatus,
  applyFactOverride,
  resolveDepositPaid,
  resolveContractSigned,
  resolveOnboardingFacts,
  resolveCardOnFileFact,
  inviteBlockerMessage,
  readinessNotYetComputedSnapshot,
  portalEligibilityTransition,
} from './domain/eligibility';

export type {
  PortalBlockerCode,
  BillingPath,
  OnboardingEventType,
  PortalAllowedActions,
  PortalEligibilitySnapshot,
  ComputePortalEligibilityInput,
  PaidInstallmentStatus,
  OnboardingFactInput,
  OnboardingFacts,
  PortalEligibilityTransition,
} from './domain/eligibility';
