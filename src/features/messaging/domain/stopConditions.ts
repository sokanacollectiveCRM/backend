import {
  ClientFacts,
  ContractFacts,
  ReminderPolicy,
  ReminderRun,
  StopConditions,
} from './types';

export type StopReason =
  | 'signed_and_deposit_paid'
  | 'contract_status'
  | 'reminders_stopped'
  | 'birth_outcomes_recorded'
  | 'note_created'
  | 'policy_disabled'
  | 'evaluation_sent'
  | 'hours_recovered'
  | 'card_on_file'
  | 'completed';

export function parseStopConditions(raw: unknown): StopConditions {
  if (
    raw &&
    typeof raw === 'object' &&
    Array.isArray((raw as StopConditions).rules)
  ) {
    return raw as StopConditions;
  }
  return { rules: [] };
}

export function evaluateStopConditions(input: {
  policy: ReminderPolicy;
  run: ReminderRun;
  contract?: ContractFacts | null;
  client?: ClientFacts | null;
}): StopReason | null {
  const { policy, run, contract, client } = input;
  if (!policy.enabled) return 'policy_disabled';
  if (run.status === 'stopped_by_admin') return 'reminders_stopped';
  if (contract?.remindersStopped) return 'reminders_stopped';

  for (const rule of parseStopConditions(policy.stop_conditions).rules) {
    switch (rule.type) {
      case 'signed_and_deposit_paid': {
        if (!contract) break;
        const signed = contract.status === 'signed';
        const paid = !contract.depositDue || contract.depositPaid;
        if (signed && paid) return 'signed_and_deposit_paid';
        break;
      }
      case 'contract_status_in': {
        const statuses = (rule.statuses || []).map((s) => s.toLowerCase());
        if (contract && statuses.includes(contract.status.toLowerCase())) {
          return 'contract_status';
        }
        break;
      }
      case 'reminders_stopped':
        if (contract?.remindersStopped) {
          return 'reminders_stopped';
        }
        break;
      case 'birth_outcomes_recorded':
        if (client?.birthOutcomesRecorded) return 'birth_outcomes_recorded';
        break;
      case 'note_created':
        if (
          client?.lastNoteAt &&
          client.lastNoteAt.getTime() >= run.anchor_at.getTime()
        ) {
          return 'note_created';
        }
        break;
      case 'card_on_file':
        if (client?.cardOnFile) return 'card_on_file';
        break;
      default:
        break;
    }
  }
  return null;
}

export function isSignedContract(status: string | null | undefined): boolean {
  return String(status || '').toLowerCase() === 'signed';
}

export const UNSIGNED_PENDING_STATUSES = new Set([
  'sent',
  'viewed',
  'partially_signed',
]);
