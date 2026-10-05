/**
 * Public contracts feature API.
 * Cross-feature consumers should import from this barrel only.
 *
 * Infrastructure adapters are wired in `composition.ts`, which is not
 * re-exported here.
 */

export {
  calculateContractPricing,
  formatCentsAsDollarString,
  parseMoneyToCents,
} from './domain/calculations';
export { classifyContractTemplate } from './domain/classification';
export {
  normalizeContractPayload,
  normalizeLegacyContractPayload,
} from './domain/normalization';
export { shouldCreateClientPaymentSchedule } from './domain/billing';
export {
  assertContractStatusTransition,
  canTransitionContractStatus,
  getAllowedContractStatusTransitions,
} from './domain/statusMachine';
export type {
  ContractSnapshot,
  ContractStatus,
  SafeContractDto,
} from './domain/types';

export {
  ContractConflictError,
  ContractNotFoundError,
  ContractService,
} from './application/contractService';
export {
  InvalidInvitationError,
  InvitationService,
} from './application/invitationService';
export {
  RateLimitExceededError,
  RateLimitService,
} from './application/rateLimitService';
export {
  InvalidSigningAccessSessionError,
  SigningAccessSessionService,
} from './application/signingAccessSessionService';
export {
  SIGNING_SESSION_DOCUMENT_PATH,
  SigningInputError,
  SigningSessionService,
} from './application/signingSessionService';

export { ContractController } from './http/contractController';
export { SigningController } from './http/signingController';
export { createAdminContractRoutes } from './http/adminContractRoutes';
export { createClientContractRoutes } from './http/clientContractRoutes';
export { createSigningRoutes } from './http/signingRoutes';
