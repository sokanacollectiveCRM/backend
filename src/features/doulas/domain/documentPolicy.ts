// Canonical P-22 configuration. Generate the frontend copy with scripts/sync-document-policy.cjs.
export const UPLOADABLE_DOULA_DOCUMENT_TYPES = [
  'training_certificate',
  'w9',
  'direct_deposit_form',
  'liability_insurance_certificate',
  'illinois_medicaid_certification',
  'cpr',
  'hipaa',
  'miscellaneous',
  'license',
  'other',
] as const;
export type UploadableDocumentType =
  (typeof UPLOADABLE_DOULA_DOCUMENT_TYPES)[number];
// This is the ONLY configurable requirements list. Remove a type to make it optional.
// Remove background_check_cleared to stop requiring clearance for submission/approval.
export const PROFILE_REQUIREMENTS: readonly (
  | UploadableDocumentType
  | 'background_check_cleared'
)[] = [
  'training_certificate',
  'w9',
  'direct_deposit_form',
  'background_check_cleared',
];
export const BACKGROUND_CHECK_REQUIRED = PROFILE_REQUIREMENTS.includes(
  'background_check_cleared'
);
export const REQUIRED_DOULA_DOCUMENT_TYPES = PROFILE_REQUIREMENTS.filter(
  (type): type is UploadableDocumentType => type !== 'background_check_cleared'
);
export const OPTIONAL_DOULA_DOCUMENT_TYPES =
  UPLOADABLE_DOULA_DOCUMENT_TYPES.filter(
    (type) => !REQUIRED_DOULA_DOCUMENT_TYPES.includes(type)
  );
// Legacy license/other remain accepted and visible when present; new miscellaneous uploads use miscellaneous.
export const PORTAL_DOULA_DOCUMENT_TYPES =
  UPLOADABLE_DOULA_DOCUMENT_TYPES.filter(
    (type) => type !== 'license' && type !== 'other'
  );
export function isRequiredDocument(type: string): boolean {
  return (REQUIRED_DOULA_DOCUMENT_TYPES as readonly string[]).includes(type);
}
export function backgroundCheckSatisfied(
  status: unknown,
  required = BACKGROUND_CHECK_REQUIRED
): boolean {
  return !required || status === 'cleared';
}
