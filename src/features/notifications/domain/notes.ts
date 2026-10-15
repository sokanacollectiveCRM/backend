import { isRuleEnabled } from './catalog';
import { noteIsOverdue } from './time';

export interface OverdueNoteSnapshot {
  clientId: string;
  assignmentId: string;
  lastNoteId: string | null;
  lastActivityAt: Date;
  postponed: boolean;
  killed: boolean;
}

export interface OverdueNoteAction {
  ruleId: 'overdue_notes';
  dedupeKey: string;
}

export function overdueNoteAction(
  snapshot: OverdueNoteSnapshot,
  now: Date
): OverdueNoteAction | null {
  if (
    snapshot.killed ||
    snapshot.postponed ||
    !isRuleEnabled('overdue_notes') ||
    !noteIsOverdue(snapshot.lastActivityAt, now)
  ) {
    return null;
  }
  const noteKey = snapshot.lastNoteId ?? `assignment:${snapshot.assignmentId}`;
  return {
    ruleId: 'overdue_notes',
    dedupeKey: `client:${snapshot.clientId}:notes:${noteKey}:overdue`,
  };
}
