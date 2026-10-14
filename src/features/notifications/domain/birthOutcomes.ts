import { BIRTH_OUTCOME_ADMIN_AFTER_REMINDERS, isRuleEnabled } from './catalog';
import { birthOutcomeSlot, birthOutcomeStart } from './time';

export interface BirthOutcomeSnapshot {
  clientId: string;
  dueDate: Date | null;
  babyDeliveredAt: Date | null;
  outcomesLogged: boolean;
  postponed: boolean;
  killed: boolean;
}

export interface BirthOutcomeAction {
  kind: 'doula_email' | 'admin_alert';
  ruleId: 'birth_outcomes_doula' | 'birth_outcomes_admin';
  dedupeKey: string;
  blocksPayout: boolean;
}

export function outcomesAreLogged(input: {
  narrative: string | null;
  induction: boolean | null;
  deliveryType: string | null;
  medications: string[] | null;
}): boolean {
  if (input.narrative && input.narrative.trim()) return true;
  if (input.induction !== null && input.induction !== undefined) return true;
  if (input.deliveryType && input.deliveryType.trim()) return true;
  return Boolean(input.medications && input.medications.length > 0);
}

export function birthOutcomeActions(
  snapshot: BirthOutcomeSnapshot,
  now: Date
): BirthOutcomeAction[] {
  if (snapshot.killed || snapshot.postponed || snapshot.outcomesLogged) {
    return [];
  }
  const start = birthOutcomeStart(snapshot);
  if (!start) return [];
  const slot = birthOutcomeSlot(start, now);
  if (slot === null) return [];

  const actions: BirthOutcomeAction[] = [];
  if (isRuleEnabled('birth_outcomes_doula')) {
    actions.push({
      kind: 'doula_email',
      ruleId: 'birth_outcomes_doula',
      dedupeKey: `client:${snapshot.clientId}:birth-outcomes:${slot}`,
      blocksPayout: true,
    });
  }
  if (
    slot + 1 >= BIRTH_OUTCOME_ADMIN_AFTER_REMINDERS &&
    isRuleEnabled('birth_outcomes_admin')
  ) {
    actions.push({
      kind: 'admin_alert',
      ruleId: 'birth_outcomes_admin',
      dedupeKey: `client:${snapshot.clientId}:birth-outcomes:admin`,
      blocksPayout: true,
    });
  }
  return actions;
}

export function birthOutcomesBlockPayout(
  snapshot: BirthOutcomeSnapshot,
  now: Date
): boolean {
  if (snapshot.outcomesLogged || snapshot.postponed) return false;
  const start = birthOutcomeStart(snapshot);
  if (!start) return false;
  return birthOutcomeSlot(start, now) !== null;
}
