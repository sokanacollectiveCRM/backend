import {
  birthOutcomeActions,
  birthOutcomesBlockPayout,
  outcomesAreLogged,
} from '../domain/birthOutcomes';
import {
  NOTIFICATION_RULES,
  NotificationRuleId,
  isRuleEnabled,
} from '../domain/catalog';
import { overdueNoteAction } from '../domain/notes';
import { signingActions } from '../domain/signing';
import { addDays } from '../domain/time';

const baseSigning = {
  contractId: 'contract-1',
  status: 'sent',
  windowStartedAt: new Date('2026-10-01T15:00:00.000Z'),
  phase: 'standard' as const,
  remindersDisabled: false,
  postponed: false,
  depositUnpaid: false,
  killed: false,
};

describe('notification rule catalog', () => {
  it('keeps every rule fixed and leaves later features off', () => {
    const ids = Object.keys(NOTIFICATION_RULES) as NotificationRuleId[];
    expect(ids.every((id) => NOTIFICATION_RULES[id].editable === false)).toBe(
      true
    );
    expect(isRuleEnabled('service_completed_evaluation')).toBe(false);
    expect(isRuleEnabled('evaluation_received')).toBe(false);
    expect(isRuleEnabled('postpartum_hours_low')).toBe(false);
    expect(isRuleEnabled('billing_card_issue')).toBe(false);
    expect(isRuleEnabled('doula_interview_logged')).toBe(false);
    expect(NOTIFICATION_RULES.contract_day7_void.adminEmail).toBe(false);
    expect(NOTIFICATION_RULES.overdue_notes.adminEmail).toBe(true);
  });
});

describe('contract signing rules', () => {
  it('does nothing before day 3 and sends the soft reminder on day 3', () => {
    const start = baseSigning.windowStartedAt;
    expect(signingActions(baseSigning, addDays(start, 2))).toEqual([]);
    const actions = signingActions(baseSigning, addDays(start, 3));
    expect(actions.map((action) => action.kind)).toEqual([
      'day3_client',
      'day3_doula',
    ]);
  });

  it('voids an unsigned contract on day 7 and never voids a signed one', () => {
    const onDay7 = addDays(baseSigning.windowStartedAt, 7);
    expect(
      signingActions(baseSigning, onDay7).map((action) => action.kind)
    ).toEqual(['void_unsigned']);
    const signedUnpaid = signingActions(
      { ...baseSigning, status: 'signed', depositUnpaid: true },
      onDay7
    );
    expect(signedUnpaid.map((action) => action.kind)).toEqual([
      'deposit_unpaid_alert',
    ]);
    expect(
      signingActions(
        { ...baseSigning, status: 'signed', depositUnpaid: false },
        onDay7
      )
    ).toEqual([]);
  });

  it('stops for decline, void, expiry, reminders off, postponement, and the kill switch', () => {
    const onDay7 = addDays(baseSigning.windowStartedAt, 7);
    for (const status of ['declined', 'voided', 'expired']) {
      expect(signingActions({ ...baseSigning, status }, onDay7)).toEqual([]);
    }
    expect(
      signingActions({ ...baseSigning, remindersDisabled: true }, onDay7)
    ).toEqual([]);
    expect(signingActions({ ...baseSigning, postponed: true }, onDay7)).toEqual(
      []
    );
    expect(signingActions({ ...baseSigning, killed: true }, onDay7)).toEqual(
      []
    );
  });

  it('keeps the same reminder key when the window does not change', () => {
    const first = signingActions(
      baseSigning,
      addDays(baseSigning.windowStartedAt, 3)
    );
    const resent = signingActions(
      baseSigning,
      addDays(baseSigning.windowStartedAt, 4)
    );
    expect(first[0]?.dedupeKey).toBe(resent[0]?.dedupeKey);
  });

  it('starts a restarted window at the day-3 step and still gives seven days', () => {
    const restartedAt = new Date('2026-10-20T15:00:00.000Z');
    const resumed = {
      ...baseSigning,
      windowStartedAt: restartedAt,
      phase: 'resumed_at_day3' as const,
    };
    expect(
      signingActions(resumed, restartedAt).map((action) => action.kind)
    ).toEqual(['day3_client', 'day3_doula']);
    expect(
      signingActions(resumed, addDays(restartedAt, 6)).some(
        (action) => action.kind === 'void_unsigned'
      )
    ).toBe(false);
    expect(
      signingActions(resumed, addDays(restartedAt, 7)).map(
        (action) => action.kind
      )
    ).toEqual(['void_unsigned']);
  });
});

describe('birth outcomes and overdue notes', () => {
  const start = new Date('2026-10-01T12:00:00.000Z');

  it('skips logged outcomes and blocks payout once the reminder window has started', () => {
    const open = {
      clientId: 'client-1',
      dueDate: addDays(start, -5),
      babyDeliveredAt: null,
      outcomesLogged: false,
      postponed: false,
      killed: false,
    };
    expect(
      birthOutcomeActions(open, start).map((action) => action.kind)
    ).toEqual(['doula_email']);
    expect(
      birthOutcomeActions(open, addDays(start, 4)).some(
        (action) => action.kind === 'admin_alert'
      )
    ).toBe(true);
    expect(
      birthOutcomeActions({ ...open, outcomesLogged: true }, start)
    ).toEqual([]);
    expect(birthOutcomesBlockPayout(open, start)).toBe(true);
    expect(
      outcomesAreLogged({
        narrative: '',
        induction: null,
        deliveryType: null,
        medications: [],
      })
    ).toBe(false);
  });

  it('emails once per missing note and stops when a newer note exists', () => {
    const snapshot = {
      clientId: 'client-1',
      assignmentId: 'assignment-1',
      lastNoteId: 'note-1',
      lastActivityAt: start,
      postponed: false,
      killed: false,
    };
    expect(overdueNoteAction(snapshot, addDays(start, 6))).toBeNull();
    const due = overdueNoteAction(snapshot, addDays(start, 7));
    expect(due?.dedupeKey).toContain('note-1');
    expect(
      overdueNoteAction(
        {
          ...snapshot,
          lastNoteId: 'note-2',
          lastActivityAt: addDays(start, 7),
        },
        addDays(start, 8)
      )
    ).toBeNull();
  });
});
