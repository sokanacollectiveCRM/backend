import { isRuleEnabled } from './catalog';
import { wholeDaysBetween } from './time';

const UNSIGNED = new Set(['sent', 'viewed', 'partially_signed']);
const STOPPED = new Set(['declined', 'voided', 'expired']);

export interface SigningSnapshot {
  contractId: string;
  status: string;
  windowStartedAt: Date;
  phase: 'standard' | 'resumed_at_day3';
  remindersDisabled: boolean;
  postponed: boolean;
  depositUnpaid: boolean;
  killed: boolean;
}

export type SigningActionKind =
  | 'day3_client'
  | 'day3_doula'
  | 'void_unsigned'
  | 'deposit_unpaid_alert';

export interface SigningAction {
  kind: SigningActionKind;
  ruleId:
    | 'contract_day3_client'
    | 'contract_day3_doula'
    | 'contract_day7_void'
    | 'contract_day7_deposit_unpaid';
  dedupeKey: string;
}

export function signingActions(
  snapshot: SigningSnapshot,
  now: Date
): SigningAction[] {
  if (
    snapshot.killed ||
    snapshot.postponed ||
    snapshot.remindersDisabled ||
    STOPPED.has(snapshot.status)
  ) {
    return [];
  }
  if (snapshot.status === 'signed' && !snapshot.depositUnpaid) return [];

  const elapsed = wholeDaysBetween(snapshot.windowStartedAt, now);
  const day3Due =
    snapshot.phase === 'resumed_at_day3' ? elapsed >= 0 : elapsed >= 3;
  const day7Due = elapsed >= 7;
  const windowKey = snapshot.windowStartedAt.toISOString();
  const prefix = `contract:${snapshot.contractId}:window:${windowKey}`;
  const actions: SigningAction[] = [];

  if (UNSIGNED.has(snapshot.status) && day3Due && !day7Due) {
    if (isRuleEnabled('contract_day3_client')) {
      actions.push({
        kind: 'day3_client',
        ruleId: 'contract_day3_client',
        dedupeKey: `${prefix}:day3:client`,
      });
    }
    if (isRuleEnabled('contract_day3_doula')) {
      actions.push({
        kind: 'day3_doula',
        ruleId: 'contract_day3_doula',
        dedupeKey: `${prefix}:day3:doula`,
      });
    }
  }

  if (
    UNSIGNED.has(snapshot.status) &&
    day7Due &&
    isRuleEnabled('contract_day7_void')
  ) {
    actions.push({
      kind: 'void_unsigned',
      ruleId: 'contract_day7_void',
      dedupeKey: `${prefix}:day7:void`,
    });
  }

  if (
    snapshot.status === 'signed' &&
    snapshot.depositUnpaid &&
    day7Due &&
    isRuleEnabled('contract_day7_deposit_unpaid')
  ) {
    actions.push({
      kind: 'deposit_unpaid_alert',
      ruleId: 'contract_day7_deposit_unpaid',
      dedupeKey: `${prefix}:day7:deposit-unpaid`,
    });
  }

  return actions;
}
