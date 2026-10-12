export const POSTPONEMENT_REASONS = [
  'waiting_on_paycheck',
  'waiting_on_insurance_or_medicaid',
  'other',
] as const;

export type PostponementReason = (typeof POSTPONEMENT_REASONS)[number];

export function postponementReasonLabel(reason: PostponementReason): string {
  switch (reason) {
    case 'waiting_on_paycheck':
      return 'waiting on a paycheck';
    case 'waiting_on_insurance_or_medicaid':
      return 'waiting on insurance or Medicaid';
    case 'other':
      return 'another reason';
    default:
      return 'another reason';
  }
}

export function postponementPausesClient(status: string | null): boolean {
  return status === 'active';
}
