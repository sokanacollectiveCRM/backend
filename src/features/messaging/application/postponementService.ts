import { addDelay, formatMergeDate } from '../domain/delay';
import {
  ClientPostponement,
  PostponementReasonCode,
  PostponementStatus,
} from '../domain/types';
import { ReminderEngine } from './reminderEngine';
import { MessagingStore } from './store';

const DEFAULT_MAX_DAYS = 14;

export class PostponementService {
  constructor(
    private readonly store: MessagingStore,
    private readonly engine: ReminderEngine,
    private readonly now: () => Date = () => new Date()
  ) {}

  async list(clientId: string): Promise<ClientPostponement[]> {
    return this.store.listPostponements(clientId);
  }

  async create(input: {
    clientId: string;
    contractId?: string | null;
    reasonCode: PostponementReasonCode;
    reasonNote?: string | null;
    restartAt?: Date;
    actorId: string;
    asAdmin: boolean;
  }): Promise<{ postponement: ClientPostponement; warning?: string }> {
    const now = this.now();
    const defaultRestart = addDelay(now, DEFAULT_MAX_DAYS, 'days');
    const restartAt = input.restartAt ?? defaultRestart;
    const days = Math.ceil(
      (restartAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
    );
    const warning =
      days > DEFAULT_MAX_DAYS
        ? `Restart date is ${days} days out (default max ${DEFAULT_MAX_DAYS}).`
        : undefined;

    const status: PostponementStatus = input.asAdmin ? 'active' : 'requested';
    const postponement = await this.store.createPostponement({
      clientId: input.clientId,
      contractId: input.contractId ?? null,
      reasonCode: input.reasonCode,
      reasonNote: input.reasonNote ?? null,
      requestedBy: input.actorId,
      approvedBy: input.asAdmin ? input.actorId : null,
      startsAt: now,
      restartAt,
      maxDays: DEFAULT_MAX_DAYS,
      status,
    });
    await this.store.appendPostponementEvent({
      postponementId: postponement.id,
      eventType: input.asAdmin ? 'created_active' : 'requested',
      actorId: input.actorId,
      payload: {
        reasonCode: input.reasonCode,
        restartAt: restartAt.toISOString(),
      },
    });
    if (input.asAdmin) {
      await this.activate(postponement, input.actorId);
    }
    return { postponement, warning };
  }

  async approve(id: string, actorId: string): Promise<ClientPostponement> {
    const postponement = await this.require(id);
    if (postponement.status !== 'requested') {
      throw Object.assign(new Error('Postponement is not awaiting approval'), {
        statusCode: 409,
      });
    }
    const updated = await this.store.updatePostponement(id, {
      status: 'active',
      approvedBy: actorId,
    });
    await this.store.appendPostponementEvent({
      postponementId: id,
      eventType: 'approved',
      actorId,
    });
    await this.activate(updated, actorId);
    return updated;
  }

  async lift(id: string, actorId: string): Promise<ClientPostponement> {
    const postponement = await this.requireActive(id);
    const now = this.now();
    const updated = await this.store.updatePostponement(id, {
      status: 'lifted',
      restartAt: now,
    });
    await this.store.appendPostponementEvent({
      postponementId: id,
      eventType: 'lifted',
      actorId,
    });
    await this.engine.restartRunsFromAnchor(
      postponement.clientId,
      postponement.contractId,
      now
    );
    await this.store.createAlert({
      type: 'postponement_lifted',
      clientId: postponement.clientId,
      contractId: postponement.contractId,
      message: `Postponement lifted early; reminders restarted ${formatMergeDate(now)}`,
    });
    return updated;
  }

  async extend(
    id: string,
    actorId: string,
    restartAt: Date
  ): Promise<{ postponement: ClientPostponement; warning?: string }> {
    const postponement = await this.requireActive(id);
    const now = this.now();
    const days = Math.ceil(
      (restartAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
    );
    const warning =
      days > postponement.maxDays
        ? `Restart date is ${days} days out (max ${postponement.maxDays}).`
        : undefined;
    const updated = await this.store.updatePostponement(id, { restartAt });
    await this.store.appendPostponementEvent({
      postponementId: id,
      eventType: 'extended',
      actorId,
      payload: { restartAt: restartAt.toISOString() },
    });
    return { postponement: updated, warning };
  }

  async cancel(id: string, actorId: string): Promise<ClientPostponement> {
    const postponement = await this.requireActive(id);
    const now = this.now();
    const updated = await this.store.updatePostponement(id, {
      status: 'canceled',
    });
    await this.store.appendPostponementEvent({
      postponementId: id,
      eventType: 'canceled',
      actorId,
    });
    const runs = await this.store.listRuns({
      clientId: postponement.clientId,
      status: 'paused',
    });
    for (const run of runs) {
      if (
        postponement.contractId &&
        run.contractId &&
        run.contractId !== postponement.contractId
      ) {
        continue;
      }
      await this.store.updateRun(run.id, {
        status: 'active',
        endActionDueAt: now,
        nextDueAt: now,
        pauseReason: null,
      });
    }
    await this.engine.tick();
    return updated;
  }

  private async activate(
    postponement: ClientPostponement,
    actorId: string
  ): Promise<void> {
    await this.store.pauseRunsForSubject({
      clientId: postponement.clientId,
      contractId: postponement.contractId,
      reason: 'postponement',
    });
    await this.engine.handleEvent({
      type: 'postponement_event',
      clientId: postponement.clientId,
      contractId: postponement.contractId,
      postponementId: postponement.id,
      eventType: 'paused',
    });
    void actorId;
  }

  private async require(id: string): Promise<ClientPostponement> {
    const row = await this.store.getPostponement(id);
    if (!row) {
      throw Object.assign(new Error('Postponement not found'), {
        statusCode: 404,
      });
    }
    return row;
  }

  private async requireActive(id: string): Promise<ClientPostponement> {
    const row = await this.require(id);
    if (row.status !== 'active') {
      throw Object.assign(new Error('Postponement is not active'), {
        statusCode: 409,
      });
    }
    return row;
  }
}
