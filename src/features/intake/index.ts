/**
 * Public intake feature API (PR 8).
 * Cross-feature consumers should import from this barrel only.
 */

export {
  normalizePublicIntakeSubmission,
  pickIntakeShadowCompareSlice,
  diffIntakeShadowSlices,
  INTAKE_SHADOW_COMPARE_KEYS,
} from './domain/normalizePublicSubmission';

export {
  INTAKE_PAYMENT_METHOD_OPTIONS,
  parseIntakePaymentMethod,
  parseIntakeClientAgeYears,
  parseIntakeProviderType,
  validateIntakeBirthPlace,
  normalizeIntakeHomeTypes,
  parseIntakeHomePeopleCount,
  legacyHomeTypeVarchar,
} from './domain/requestSubmissionDto';

export type { IntakeLeadRepository } from './application/ports';
export {
  submitPublicRequestForm,
  mapIntakeResponseToRequestForm,
} from './application/submitPublicRequestForm';

export { LegacyRequestFormRepositoryAdapter } from './infrastructure/legacyRequestFormRepositoryAdapter';

export {
  protectPublicIntakeEarly,
  evaluateIntakeSubmissionGuards,
  finalizeIntakeIdempotency,
  isIntakeHoneypotTriggered,
  getIntakeAbuseConfig,
  MemoryIntakeAbuseStore,
  setIntakeAbuseStoreForTests,
  resetIntakeAbuseStoreForTests,
} from './infrastructure/intakeAbuseProtection';

export {
  PUBLIC_INTAKE_SUCCESS_MESSAGE,
  PUBLIC_INTAKE_PATH,
} from './http/publicSubmissionContract';

export {
  INTAKE_STAFF_NOTIFICATION_SUBJECT,
  INTAKE_SUBMITTER_CONFIRMATION_SUBJECT,
  INTAKE_EMAIL_FORBIDDEN_FIELD_LABELS,
  buildIntakeStaffNotificationEmail,
  buildIntakeSubmitterConfirmationEmail,
  buildAuthenticatedCrmClientUrl,
  intakeEmailContainsForbiddenLabels,
} from './notifications/intakeStaffNotificationEmail';
export type {
  IntakeStaffNotificationInput,
  IntakeEmailContent,
} from './notifications/intakeStaffNotificationEmail';
