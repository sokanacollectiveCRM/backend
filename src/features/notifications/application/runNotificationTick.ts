import { logger } from '../../../common/utils/logger';
import { InvitationService } from '../../contracts/application/invitationService';
import { contractRepository } from '../../contracts/infrastructure/contractRepository';
import { invitationRepository } from '../../contracts/infrastructure/invitationRepository';
import {
  birthOutcomeActions,
  birthOutcomesBlockPayout,
} from '../domain/birthOutcomes';
import type { BirthOutcomeSnapshot } from '../domain/birthOutcomes';
import { displayFirstName } from '../domain/names';
import { overdueNoteAction } from '../domain/notes';
import type { OverdueNoteSnapshot } from '../domain/notes';
import { signingActions } from '../domain/signing';
import type { SigningAction, SigningSnapshot } from '../domain/signing';
import { signingCancelDate } from '../domain/time';
import { NotificationEmail } from '../infrastructure/notificationEmail';
import {
  BirthCandidate,
  NoteCandidate,
  NotificationStore,
  SigningCandidate,
} from '../infrastructure/notificationStore';

const UNSIGNED = new Set(['sent', 'viewed', 'partially_signed']);

const invitations = new InvitationService(invitationRepository, {
  findInvitationContract: async () => null,
});

function signingSnapshot(
  row: SigningCandidate,
  killed: boolean
): SigningSnapshot {
  return {
    contractId: row.contractId,
    status: row.status,
    windowStartedAt: row.windowStartedAt,
    phase: row.phase,
    remindersDisabled: row.remindersDisabled,
    postponed: row.postponed,
    depositUnpaid: row.depositUnpaid,
    killed,
  };
}

function birthSnapshot(
  row: BirthCandidate,
  killed: boolean
): BirthOutcomeSnapshot {
  return {
    clientId: row.clientId,
    dueDate: row.dueDate,
    babyDeliveredAt: row.babyDeliveredAt,
    outcomesLogged: row.outcomesLogged,
    postponed: row.postponed,
    killed,
  };
}

function noteSnapshot(
  row: NoteCandidate,
  killed: boolean
): OverdueNoteSnapshot {
  return {
    clientId: row.clientId,
    assignmentId: row.assignmentId,
    lastNoteId: row.lastNoteId,
    lastActivityAt: row.lastActivityAt,
    postponed: row.postponed,
    killed,
  };
}

function signingLink(token: string): string {
  const configured = process.env.CONTRACT_SIGNING_BASE_URL || '';
  const fallback = process.env.FRONTEND_URL
    ? `${process.env.FRONTEND_URL.replace(/\/$/, '')}/signing`
    : '';
  const base = (configured || fallback).replace(/\/$/, '');
  return `${base}#invitation=${encodeURIComponent(token)}`;
}

function clientUrl(clientId: string): string | null {
  const base = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
  return base ? `${base}/clients/${clientId}` : null;
}

export interface NotificationTickResult {
  killed: boolean;
  restarted: number;
  sent: number;
  failed: number;
  skipped: number;
}

export async function runNotificationTick(
  now = new Date(),
  store = new NotificationStore(),
  email = new NotificationEmail()
): Promise<NotificationTickResult> {
  const result: NotificationTickResult = {
    killed: false,
    restarted: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
  };
  if (await store.isKilled()) {
    result.killed = true;
    return result;
  }

  const due = await store.listDuePostponements();
  for (const row of due) {
    if (await store.isKilled()) {
      result.killed = true;
      return result;
    }
    const restarted = await store.restartPostponement(row.id, row.clientId);
    if (!restarted) continue;
    result.restarted += 1;
    const first = displayFirstName(await store.clientFirstName(row.clientId));
    await store.upsertNotice({
      dedupeKey: `postponement:${row.id}:restart`,
      audience: 'admin',
      clientId: row.clientId,
      severity: 'info',
      title: `${first} is ready to restart`,
      body: 'A postponement reached its restart date. Signing reminders resume at the day-3 step.',
      ruleId: 'postponement_restart',
    });
  }

  await store.resolveBirthNotices();

  for (const row of await store.listSigningCandidates()) {
    await runSigningRow(row, now, store, email, result);
  }
  for (const row of await store.listBirthCandidates()) {
    await runBirthRow(row, now, store, email, result);
  }
  for (const row of await store.listNoteCandidates()) {
    await runNoteRow(row, now, store, email, result);
  }
  return result;
}

async function runSigningRow(
  row: SigningCandidate,
  now: Date,
  store: NotificationStore,
  email: NotificationEmail,
  result: NotificationTickResult
): Promise<void> {
  const killed = await store.isKilled();
  for (const action of signingActions(signingSnapshot(row, killed), now)) {
    await performSigning(row, action, now, store, email, result);
  }
}

async function performSigning(
  row: SigningCandidate,
  action: SigningAction,
  now: Date,
  store: NotificationStore,
  email: NotificationEmail,
  result: NotificationTickResult
): Promise<void> {
  const channel = action.kind === 'day3_doula' ? 'email_doula' : action.kind;
  const claimed = await store.claim({
    dedupeKey: action.dedupeKey,
    ruleId: action.ruleId,
    channel,
    subjectType: 'contract',
    subjectId: row.contractId,
  });
  if (!claimed) return;

  try {
    const killed = await store.isKilled();
    const fresh = (await store.listSigningCandidates()).find(
      (candidate) => candidate.contractId === row.contractId
    );
    const still = fresh
      ? signingActions(signingSnapshot(fresh, killed), now).some(
          (candidate) => candidate.dedupeKey === action.dedupeKey
        )
      : false;
    if (!fresh || !still) {
      if (!fresh || fresh.postponed || killed) {
        await store.releaseClaim(action.dedupeKey);
      } else {
        await store.markDelivery(action.dedupeKey, 'skipped');
        result.skipped += 1;
      }
      return;
    }

    const first = displayFirstName(fresh.clientFirstName);
    const cancelBy = signingCancelDate(fresh.windowStartedAt);
    if (action.kind === 'day3_client' && fresh.clientEmail) {
      const issued = await invitations.issue(
        fresh.contractId,
        fresh.clientId,
        true
      );
      await email.sendSigningSoftReminder({
        to: fresh.clientEmail,
        clientFirstName: first,
        signingUrl: signingLink(issued.token),
        cancelBy,
      });
    } else if (action.kind === 'day3_doula' && fresh.doulaEmail) {
      await email.sendDoulaUnsignedNudge({
        to: fresh.doulaEmail,
        clientFirstName: first,
      });
    } else if (action.kind === 'void_unsigned') {
      if (UNSIGNED.has(fresh.status)) {
        await contractRepository.voidContract(
          fresh.contractId,
          '',
          'unsigned_after_7_days'
        );
      }
      if (fresh.clientEmail) {
        await email.sendContractCanceled({
          to: fresh.clientEmail,
          clientFirstName: first,
        });
      }
      await store.upsertNotice({
        dedupeKey: action.dedupeKey,
        audience: 'admin',
        clientId: fresh.clientId,
        severity: 'info',
        title: `Contract canceled for ${first}`,
        body: 'The contract was still unsigned after 7 days.',
        ruleId: action.ruleId,
      });
    } else if (action.kind === 'deposit_unpaid_alert') {
      await store.upsertNotice({
        dedupeKey: action.dedupeKey,
        audience: 'admin',
        clientId: fresh.clientId,
        severity: 'info',
        title: `Deposit unpaid for ${first}`,
        body: 'The contract is signed and the deposit is unpaid. Nancy or Antrice can handle this manually. The contract was not canceled.',
        ruleId: action.ruleId,
      });
    } else {
      await store.releaseClaim(action.dedupeKey);
      return;
    }

    await store.markDelivery(action.dedupeKey, 'sent');
    result.sent += 1;
    logger.info(
      {
        service: 'notification-rules',
        ruleId: action.ruleId,
        contractId: fresh.contractId,
      },
      'Notification rule sent'
    );
  } catch (error) {
    await store.markDelivery(action.dedupeKey, 'failed');
    result.failed += 1;
    logger.error(
      {
        service: 'notification-rules',
        ruleId: action.ruleId,
        contractId: row.contractId,
        err: error instanceof Error ? error.name : 'Error',
      },
      'Notification rule failed'
    );
  }
}

async function runBirthRow(
  row: BirthCandidate,
  now: Date,
  store: NotificationStore,
  email: NotificationEmail,
  result: NotificationTickResult
): Promise<void> {
  const killed = await store.isKilled();
  const snapshot = birthSnapshot(row, killed);
  for (const action of birthOutcomeActions(snapshot, now)) {
    const claimed = await store.claim({
      dedupeKey: action.dedupeKey,
      ruleId: action.ruleId,
      channel: action.kind,
      subjectType: 'client',
      subjectId: row.clientId,
    });
    if (!claimed) continue;
    try {
      const freshKilled = await store.isKilled();
      const fresh = (await store.listBirthCandidates()).find(
        (candidate) => candidate.clientId === row.clientId
      );
      if (
        !fresh ||
        !birthOutcomeActions(birthSnapshot(fresh, freshKilled), now).some(
          (candidate) => candidate.dedupeKey === action.dedupeKey
        )
      ) {
        await store.releaseClaim(action.dedupeKey);
        continue;
      }
      const first = displayFirstName(fresh.clientFirstName);
      if (action.kind === 'doula_email') {
        if (!fresh.doulaEmail) {
          await store.releaseClaim(action.dedupeKey);
          continue;
        }
        await email.sendBirthOutcomeReminder({
          to: fresh.doulaEmail,
          clientFirstName: first,
        });
      }
      await store.upsertNotice({
        dedupeKey: action.dedupeKey,
        audience: action.kind === 'admin_alert' ? 'admin' : 'doula',
        doulaId: action.kind === 'admin_alert' ? null : fresh.doulaId,
        clientId: fresh.clientId,
        severity: 'red',
        title: `Birth outcomes needed for ${first}`,
        body: 'Payout cannot be submitted until birth outcomes are recorded.',
        ruleId: action.ruleId,
        blocksPayout: birthOutcomesBlockPayout(
          birthSnapshot(fresh, freshKilled),
          now
        ),
      });
      await store.markDelivery(action.dedupeKey, 'sent');
      result.sent += 1;
    } catch (error) {
      await store.markDelivery(action.dedupeKey, 'failed');
      result.failed += 1;
      logger.error(
        {
          service: 'notification-rules',
          ruleId: action.ruleId,
          clientId: row.clientId,
          err: error instanceof Error ? error.name : 'Error',
        },
        'Birth outcome reminder failed'
      );
    }
  }
}

async function runNoteRow(
  row: NoteCandidate,
  now: Date,
  store: NotificationStore,
  email: NotificationEmail,
  result: NotificationTickResult
): Promise<void> {
  const killed = await store.isKilled();
  const action = overdueNoteAction(noteSnapshot(row, killed), now);
  if (!action) return;
  const claimed = await store.claim({
    dedupeKey: action.dedupeKey,
    ruleId: action.ruleId,
    channel: 'email',
    subjectType: 'client',
    subjectId: row.clientId,
  });
  if (!claimed) return;
  try {
    const freshKilled = await store.isKilled();
    const fresh = (await store.listNoteCandidates()).find(
      (candidate) => candidate.assignmentId === row.assignmentId
    );
    const still = fresh
      ? overdueNoteAction(noteSnapshot(fresh, freshKilled), now)
      : null;
    if (!fresh || !still || still.dedupeKey !== action.dedupeKey) {
      await store.releaseClaim(action.dedupeKey);
      return;
    }
    const first = displayFirstName(fresh.clientFirstName);
    const crmUrl = clientUrl(fresh.clientId);
    if (fresh.doulaEmail) {
      await email.sendOverdueNote({
        to: fresh.doulaEmail,
        clientFirstName: first,
        crmUrl,
      });
    }
    const adminTo = 'hello@sokanacollective.com';
    await email.sendOverdueNote({
      to: adminTo,
      clientFirstName: first,
      crmUrl,
    });
    await store.markDelivery(action.dedupeKey, 'sent');
    result.sent += 1;
  } catch (error) {
    await store.markDelivery(action.dedupeKey, 'failed');
    result.failed += 1;
    logger.error(
      {
        service: 'notification-rules',
        ruleId: action.ruleId,
        clientId: row.clientId,
        err: error instanceof Error ? error.name : 'Error',
      },
      'Overdue note reminder failed'
    );
  }
}

export { birthOutcomesBlockPayout };
