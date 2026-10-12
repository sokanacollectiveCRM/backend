import {
  ClientFacts,
  ContractFacts,
  ReminderPolicy,
  ReminderRun,
} from '../domain/types';

export function evaluateStopReason(input: {
  policy: ReminderPolicy;
  run: ReminderRun;
  contract?: ContractFacts | null;
  client?: ClientFacts | null;
}): string | null {
  const conditions = input.policy.stopConditions || [];
  const contract = input.contract;
  const client = input.client;

  if (conditions.includes('stopped_by_admin')) {
    if (input.run.status === 'stopped_by_admin') return 'stopped_by_admin';
    if (contract?.remindersStopped) return 'stopped_by_admin';
  }

  if (conditions.includes('declined') && contract?.status === 'declined') {
    return 'declined';
  }
  if (conditions.includes('voided') && contract?.status === 'voided') {
    return 'voided';
  }
  if (conditions.includes('expired') && contract?.status === 'expired') {
    return 'expired';
  }

  if (conditions.includes('signed_and_deposit_paid') && contract) {
    const signed = contract.status === 'signed';
    const depositOk = !contract.depositRequired || contract.depositPaid;
    if (signed && depositOk) return 'signed_and_deposit_paid';
  }

  if (
    conditions.includes('birth_outcomes_recorded') &&
    client?.birthOutcomesRecorded
  ) {
    return 'birth_outcomes_recorded';
  }

  if (
    conditions.includes('note_created') &&
    input.policy.key === 'overdue_notes'
  ) {
    return null;
  }

  return null;
}

export function isUnsignedPending(status: string): boolean {
  return (
    status === 'sent' || status === 'viewed' || status === 'partially_signed'
  );
}

export function isSigned(status: string): boolean {
  return status === 'signed';
}
