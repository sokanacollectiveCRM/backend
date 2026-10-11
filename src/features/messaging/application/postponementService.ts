import { addDelay } from '../domain/delays';
import { formatDateUtc } from '../domain/delays';
import {
  ClientPostponement,
  ClockPort,
  PostponementReason,
} from '../domain/types';
import { ReminderEngine } from './reminderEngine';
import { ReminderStore } from './reminderStore';

const DEFAULT_MAX_DAYS = 14;

export class PostponementService {
  constructor(
    private readonly store: ReminderStore,
    private readonly engine: ReminderEngine,
    private readonly clock: ClockPort = { now: () => new Date() }
  ) {}

  async list(clientId: string): Promise<ClientPostponement[]> {
    return this.store.listPostponements(clientId);
  }

  async create(input: {
    clientId: string;
    contractId?: string | null;
    reasonCode: PostponementReason;
    reasonNote?: string | null;
    restartAt?: Date | null;
    actorId: string;
    asRequest?: boolean;
  }): Promise<{ postponement: ClientPostponement; warning: string | null }> {
    const startsAt = this.clock.now();
    const restartAt =
      input.restartAt ?? addDelay(startsAt, DEFAULT_MAX_DAYS, 'days');
    const spanDays = Math.ceil(
      (restartAt.getTime() - startsAt.getTime()) / (24 * 60 * 60 * 1000)
    );
    const warning =
      spanDays > DEFAULT_MAX_DAYS
        ? `Restart date is ${spanDays} days out (default is ${DEFAULT_MAX_DAYS}).`
        : null;
    const postponement = await this.store.createPostponement({
      client_id: input.clientId,
      contract_id: input.contractId ?? null,
      reason_code: input.reasonCode,
      reason_note: input.reasonNote ?? null,
      requested_by: input.actorId,
      approved_by: input.asRequest ? null : input.actorId,
      starts_at: startsAt,
      restart_at: restartAt,
      max_days: DEFAULT_MAX_DAYS,
      status: input.asRequest ? 'requested' : 'active',
    });
    await this.store.appendPostponementEvent({
      postponement_id: postponement.id,
      event_type: input.asRequest ? 'requested' : 'created',
      actor_id: input.actorId,
      payload: {
        restart_at: restartAt.toISOString(),
        reason_code: input.reasonCode,
      },
    });
    if (!input.asRequest) {
      await this.activate(postponement, input.actorId);
    }
    return { postponement: { ...postponement, warning }, warning };
  }

  async approve(
    id: string,
    actorId: string
  ): Promise<ClientPostponement | null> {
    const current = await this.store.getPostponement(id);
    if (!current || current.status !== 'requested') return null;
    const updated = await this.store.updatePostponement(id, {
      status: 'active',
      approved_by: actorId,
    });
    if (!updated) return null;
    await this.store.appendPostponementEvent({
      postponement_id: id,
      event_type: 'approved',
      actor_id: actorId,
      payload: {},
    });
    await this.activate(updated, actorId);
    return updated;
  }

  async lift(id: string, actorId: string): Promise<ClientPostponement | null> {
    const current = await this.store.getPostponement(id);
    if (!current || current.status !== 'active') return null;
    await this.engine.restartFromPostponement(id, 'lift');
    await this.store.appendPostponementEvent({
      postponement_id: id,
      event_type: 'lifted',
      actor_id: actorId,
      payload: {},
    });
    return this.store.getPostponement(id);
  }

  async extend(
    id: string,
    restartAt: Date,
    actorId: string
  ): Promise<{
    postponement: ClientPostponement | null;
    warning: string | null;
  }> {
    const current = await this.store.getPostponement(id);
    if (!current || current.status !== 'active') {
      return { postponement: null, warning: null };
    }
    const spanDays = Math.ceil(
      (restartAt.getTime() - current.starts_at.getTime()) /
        (24 * 60 * 60 * 1000)
    );
    const warning =
      spanDays > DEFAULT_MAX_DAYS
        ? `Restart date is ${spanDays} days out (default is ${DEFAULT_MAX_DAYS}).`
        : null;
    const updated = await this.store.updatePostponement(id, {
      restart_at: restartAt,
      status: 'extended',
    });
    // Stay active after extend; status 'extended' is recorded then set back to active.
    const active = await this.store.updatePostponement(id, {
      status: 'active',
    });
    await this.store.appendPostponementEvent({
      postponement_id: id,
      event_type: 'extended',
      actor_id: actorId,
      payload: { restart_at: restartAt.toISOString() },
    });
    return { postponement: active ?? updated, warning };
  }

  async cancel(
    id: string,
    actorId: string
  ): Promise<ClientPostponement | null> {
    const current = await this.store.getPostponement(id);
    if (!current) return null;
    const updated = await this.store.updatePostponement(id, {
      status: 'canceled',
    });
    await this.store.appendPostponementEvent({
      postponement_id: id,
      event_type: 'canceled',
      actor_id: actorId,
      payload: {},
    });
    if (current.contract_id) {
      const policy = await this.store.getPolicyByKey('contract_signing');
      const contract = await this.store.loadContractFacts(current.contract_id);
      if (
        policy &&
        contract &&
        ['sent', 'viewed', 'partially_signed'].includes(contract.status)
      ) {
        const runs = await this.store.listRunsForContract(current.contract_id);
        for (const run of runs.filter((r) => r.status === 'paused')) {
          await this.store.updateRun(run.id, {
            status: 'active',
            next_due_at: this.clock.now(),
            end_action_due_at: this.clock.now(),
            pause_reason: null,
          });
        }
      }
    }
    return updated;
  }

  private async activate(
    postponement: ClientPostponement,
    actorId: string
  ): Promise<void> {
    await this.store.pauseRunsForClient(
      postponement.client_id,
      postponement.contract_id,
      'postponement'
    );
    await this.engine.startRun({
      policyKey: 'postponement_events',
      subjectType: 'postponement',
      subjectId: postponement.id,
      clientId: postponement.client_id,
      contractId: postponement.contract_id,
      anchorAt: postponement.starts_at,
      processImmediately: true,
      mergeExtras: {
        restart_date: formatDateUtc(postponement.restart_at),
        postponement_reason: postponement.reason_code,
      },
    });
    void actorId;
  }
}
