import { addDelay, formatDateUtc, windowStartKey } from '../domain/delays';
import { htmlFromText, renderMergeTemplate } from '../domain/mergeFields';
import {
  UNSIGNED_PENDING_STATUSES,
  evaluateStopConditions,
  isSignedContract,
} from '../domain/stopConditions';
import {
  ClockPort,
  ContractFacts,
  DelayUnit,
  MailerPort,
  MergeContext,
  MessagingSettings,
  PolicyWithSteps,
  RecipientRole,
  ReminderPolicyStep,
  ReminderRun,
  TickResult,
} from '../domain/types';
import { ReminderStore } from './reminderStore';

const DEFAULT_FRONTEND = 'https://sokana-front-end-dev-46lcr3n2qa-uc.a.run.app';

export interface ReminderEngineOptions {
  store: ReminderStore;
  mailer: MailerPort;
  clock?: ClockPort;
  frontendUrl?: string;
  testToolsEnabled?: boolean;
}

export interface StartRunInput {
  policyKey: string;
  subjectType: string;
  subjectId: string;
  clientId?: string | null;
  contractId?: string | null;
  doulaId?: string | null;
  anchorAt: Date;
  processImmediately?: boolean;
  mergeExtras?: MergeContext;
}

export class ReminderEngine {
  constructor(private readonly options: ReminderEngineOptions) {}

  now(): Date {
    return this.options.clock?.now() ?? new Date();
  }

  async tick(): Promise<TickResult> {
    const settings = await this.options.store.getSettings();
    if (!settings.reminders_enabled) {
      return {
        suppressed: true,
        claimed: 0,
        sent: 0,
        skipped: 0,
        failed: 0,
        endActions: 0,
        postponementsRestarted: 0,
        scansStarted: 0,
      };
    }

    const result: TickResult = {
      claimed: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      endActions: 0,
      postponementsRestarted: 0,
      scansStarted: 0,
    };

    result.postponementsRestarted = await this.autoRestartPostponements();
    result.scansStarted = await this.runScans(settings);

    const claimed = await this.options.store.claimDueRuns(this.now(), 50);
    result.claimed = claimed.length;
    for (const run of claimed) {
      const processed = await this.processRun(run, settings);
      result.sent += processed.sent;
      result.skipped += processed.skipped;
      result.failed += processed.failed;
      result.endActions += processed.endActions;
    }
    return result;
  }

  async startRun(input: StartRunInput): Promise<ReminderRun | null> {
    const policy = await this.options.store.getPolicyByKey(input.policyKey);
    if (!policy || !policy.enabled) return null;

    const existing = await this.options.store.findActiveOrPausedRun(
      policy.id,
      input.subjectType,
      input.subjectId
    );
    if (existing) return existing;

    if (policy.key === 'birth_outcomes' && input.clientId) {
      const client = await this.options.store.loadClientFacts(input.clientId);
      if (client?.birthOutcomesRecorded) return null;
    }

    const postponement = input.clientId
      ? await this.options.store.findActivePostponement(
          input.clientId,
          input.contractId
        )
      : null;
    const dues = this.computeSchedule(policy, input.anchorAt);
    const run = await this.options.store.createRun({
      policy,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      clientId: input.clientId,
      contractId: input.contractId,
      doulaId: input.doulaId,
      status: postponement ? 'paused' : 'active',
      anchorAt: input.anchorAt,
      currentStep: 1,
      nextDueAt: dues.nextDueAt,
      endActionDueAt: dues.endActionDueAt,
      pauseReason: postponement ? 'postponement' : null,
    });

    if (input.processImmediately && !postponement) {
      const settings = await this.options.store.getSettings();
      if (settings.reminders_enabled) {
        await this.processRun(run, settings, input.mergeExtras);
      }
    }
    return run;
  }

  async renderTemplate(
    templateId: string,
    context: MergeContext
  ): Promise<{
    subject: string;
    text: string;
    html: string;
    version: number;
    key: string;
  } | null> {
    const template = await this.options.store.getTemplate(templateId);
    if (!template) return null;
    const text = renderMergeTemplate(template.body_text, context);
    const html = template.body_html
      ? renderMergeTemplate(template.body_html, context)
      : htmlFromText(text);
    return {
      subject: renderMergeTemplate(template.subject, context),
      text,
      html,
      version: template.version,
      key: template.key,
    };
  }

  async renderContractSentInitial(input: {
    contractId: string;
    clientFirstName: string;
    clientLastName: string;
    signingUrl: string;
    sentAt: Date;
  }): Promise<{ subject: string; text: string; html: string } | null> {
    const policy = await this.options.store.getPolicyByKey('contract_signing');
    const template = await this.options.store.getTemplateByKey(
      'contract_sent_initial'
    );
    const settings = await this.options.store.getSettings();
    if (!policy || !template) return null;
    const cancelDate = this.cancelDate(policy, input.sentAt);
    const context: MergeContext = {
      client_first_name: input.clientFirstName,
      client_last_name: input.clientLastName,
      signing_link: input.signingUrl,
      contract_sent_date: formatDateUtc(input.sentAt),
      cancel_date: formatDateUtc(cancelDate),
      contact_email: settings.contact_email,
    };
    const rendered = await this.renderTemplate(template.id, context);
    if (!rendered) return null;
    return {
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
    };
  }

  async stopContractReminders(
    contractId: string,
    reason?: string
  ): Promise<number> {
    await this.options.store.setContractRemindersStopped(
      contractId,
      true,
      reason ?? null
    );
    const runs = await this.options.store.listRunsForContract(contractId);
    let count = 0;
    for (const run of runs) {
      if (run.status === 'active' || run.status === 'paused') {
        await this.options.store.updateRun(run.id, {
          status: 'stopped_by_admin',
          completed_reason: reason || 'stopped_by_admin',
          next_due_at: null,
        });
        count += 1;
      }
    }
    return count;
  }

  async resumeContractReminders(contractId: string): Promise<number> {
    const facts = await this.options.store.setContractRemindersStopped(
      contractId,
      false,
      null
    );
    const now = this.now();
    const runs = await this.options.store.listRunsForContract(contractId);
    let count = 0;
    for (const run of runs) {
      if (run.status !== 'stopped_by_admin') continue;
      const policy = await this.options.store.getPolicy(run.policy_id);
      if (!policy) continue;
      const dues = this.computeSchedule(policy, now);
      await this.options.store.updateRun(run.id, {
        status: 'active',
        anchor_at: now,
        current_step: 1,
        next_due_at: dues.nextDueAt,
        end_action_due_at: dues.endActionDueAt,
        completed_reason: null,
        pause_reason: null,
        sends_count: 0,
        admin_alerted: false,
      });
      count += 1;
    }
    if (count === 0 && facts) {
      const policy =
        await this.options.store.getPolicyByKey('contract_signing');
      if (policy?.enabled && UNSIGNED_PENDING_STATUSES.has(facts.status)) {
        await this.startRun({
          policyKey: 'contract_signing',
          subjectType: 'contract',
          subjectId: contractId,
          clientId: facts.clientId,
          contractId,
          doulaId: facts.doulaId,
          anchorAt: now,
        });
        count += 1;
      }
    }
    return count;
  }

  async completeSubjectRuns(
    policyKey: string,
    subjectType: string,
    subjectId: string,
    reason: string
  ): Promise<void> {
    const policy = await this.options.store.getPolicyByKey(policyKey);
    if (!policy) return;
    const run = await this.options.store.findActiveOrPausedRun(
      policy.id,
      subjectType,
      subjectId
    );
    if (!run) return;
    await this.options.store.updateRun(run.id, {
      status: 'completed',
      completed_reason: reason,
      next_due_at: null,
    });
  }

  async advanceRun(runId: string): Promise<TickResult> {
    const run = await this.options.store.getRun(runId);
    const settings = await this.options.store.getSettings();
    if (!run) {
      return {
        claimed: 0,
        sent: 0,
        skipped: 0,
        failed: 0,
        endActions: 0,
        postponementsRestarted: 0,
        scansStarted: 0,
      };
    }
    const processed = await this.processRun(run, settings);
    return {
      claimed: 1,
      ...processed,
      postponementsRestarted: 0,
      scansStarted: 0,
    };
  }

  private computeSchedule(
    policy: PolicyWithSteps,
    anchorAt: Date
  ): { nextDueAt: Date | null; endActionDueAt: Date | null } {
    const enabledSteps = policy.steps.filter((step) => step.enabled);
    const stepDues = enabledSteps.map((step) =>
      addDelay(anchorAt, step.delay_value, step.delay_unit)
    );
    const nextDueAt =
      stepDues.length > 0
        ? new Date(Math.min(...stepDues.map((d) => d.getTime())))
        : null;
    const endActionDueAt =
      policy.end_action &&
      policy.end_action_delay_value != null &&
      policy.end_action_delay_unit
        ? addDelay(
            anchorAt,
            policy.end_action_delay_value,
            policy.end_action_delay_unit
          )
        : null;
    return { nextDueAt, endActionDueAt };
  }

  cancelDate(policy: PolicyWithSteps, anchorAt: Date): Date {
    if (policy.end_action_delay_value != null && policy.end_action_delay_unit) {
      return addDelay(
        anchorAt,
        policy.end_action_delay_value,
        policy.end_action_delay_unit
      );
    }
    return addDelay(anchorAt, 7, 'days');
  }

  private async processRun(
    run: ReminderRun,
    settings: MessagingSettings,
    mergeExtras: MergeContext = {}
  ): Promise<{
    sent: number;
    skipped: number;
    failed: number;
    endActions: number;
  }> {
    const counts = { sent: 0, skipped: 0, failed: 0, endActions: 0 };
    const policy = await this.options.store.getPolicy(run.policy_id);
    if (!policy) {
      await this.options.store.updateRun(run.id, {
        status: 'canceled',
        completed_reason: 'policy_missing',
      });
      return counts;
    }

    const contract = run.contract_id
      ? await this.options.store.loadContractFacts(run.contract_id)
      : null;
    const client = run.client_id
      ? await this.options.store.loadClientFacts(run.client_id)
      : null;

    const stop = evaluateStopConditions({ policy, run, contract, client });
    if (stop) {
      await this.options.store.updateRun(run.id, {
        status: 'completed',
        completed_reason: stop,
        next_due_at: null,
      });
      counts.skipped += 1;
      return counts;
    }

    const now = this.now();
    const dueSteps = policy.steps.filter((step) => {
      if (!step.enabled) return false;
      const dueAt = addDelay(run.anchor_at, step.delay_value, step.delay_unit);
      return dueAt.getTime() <= now.getTime();
    });

    for (const step of dueSteps) {
      const result = await this.sendStep(
        run,
        policy,
        step,
        settings,
        contract,
        client,
        mergeExtras
      );
      counts.sent += result.sent;
      counts.skipped += result.skipped;
      counts.failed += result.failed;
      if (result.sent > 0) {
        const latest = await this.options.store.getRun(run.id);
        if (latest) {
          run.sends_count = latest.sends_count;
          run.admin_alerted = latest.admin_alerted;
        }
      }
    }

    await this.maybeAlertAfterSends(run, policy);

    const latest = await this.options.store.getRun(run.id);
    const endDue =
      (latest?.end_action_due_at || run.end_action_due_at) &&
      (latest?.end_action_due_at || run.end_action_due_at)!.getTime() <=
        now.getTime();
    if (endDue && policy.end_action && latest?.status === 'active') {
      const applied = await this.applyEndAction(
        latest,
        policy,
        contract,
        settings
      );
      counts.endActions += applied.endActions;
      counts.sent += applied.sent;
      counts.skipped += applied.skipped;
      counts.failed += applied.failed;
      return counts;
    }

    await this.scheduleNext(run, policy, now);
    return counts;
  }

  private async sendStep(
    run: ReminderRun,
    policy: PolicyWithSteps,
    step: ReminderPolicyStep,
    settings: MessagingSettings,
    contract: ContractFacts | null,
    client: Awaited<ReturnType<ReminderStore['loadClientFacts']>>,
    mergeExtras: MergeContext
  ): Promise<{ sent: number; skipped: number; failed: number }> {
    const counts = { sent: 0, skipped: 0, failed: 0 };
    const dueAt = addDelay(run.anchor_at, step.delay_value, step.delay_unit);
    let windowStart = windowStartKey(dueAt);
    if (step.repeat_every_value && step.repeat_every_unit) {
      const sentCount = await this.options.store.countSendsForRunStep(
        run.id,
        step.step_order,
        ['sent', 'pending', 'test']
      );
      if (sentCount > 0) {
        const lastWindow = addDelay(
          dueAt,
          sentCount * step.repeat_every_value,
          step.repeat_every_unit
        );
        if (lastWindow.getTime() > this.now().getTime()) {
          counts.skipped += 1;
          return counts;
        }
        windowStart = windowStartKey(lastWindow);
      }
    } else {
      const already = await this.options.store.countSendsForRunStep(
        run.id,
        step.step_order,
        ['sent', 'pending', 'test']
      );
      if (already > 0) {
        counts.skipped += 1;
        return counts;
      }
    }

    const template = await this.options.store.getTemplate(step.template_id);
    if (!template) {
      counts.skipped += 1;
      return counts;
    }
    const context = await this.buildMergeContext(
      run,
      policy,
      contract,
      client,
      settings,
      mergeExtras
    );

    for (const role of step.recipient_roles) {
      const recipient = this.recipientForRole(role, settings, contract, client);
      const idempotencyKey = `run:${run.id}:step:${step.step_order}:${role}:${windowStart}:v${template.version}`;
      const log = await this.options.store.tryInsertSendLog({
        runId: run.id,
        policyKey: policy.key,
        stepOrder: step.step_order,
        templateKey: template.key,
        templateVersion: template.version,
        idempotencyKey,
        recipientRole: role,
        recipientEmail: recipient,
        channel: step.channel,
        status: 'pending',
      });
      if (log === 'duplicate') {
        counts.skipped += 1;
        continue;
      }

      if (step.channel === 'dashboard' || step.channel === 'both') {
        await this.options.store.createAlert({
          type: `${policy.key}_dashboard`,
          client_id: run.client_id,
          contract_id: run.contract_id,
          run_id: run.id,
          message: renderMergeTemplate(template.body_text, context).slice(
            0,
            500
          ),
        });
      }

      if (step.channel === 'email' || step.channel === 'both') {
        if (!recipient) {
          await this.options.store.updateSendLog(log.id, {
            status: 'skipped',
            suppress_reason: 'missing_recipient',
          });
          counts.skipped += 1;
          continue;
        }
        const to = settings.test_recipient_override_email || recipient;
        const rendered = await this.renderTemplate(template.id, context);
        if (!rendered) {
          counts.skipped += 1;
          continue;
        }
        try {
          await this.options.mailer.sendEmail(
            to,
            rendered.subject,
            rendered.text,
            rendered.html
          );
          await this.options.store.updateSendLog(log.id, { status: 'sent' });
          counts.sent += 1;
        } catch (error) {
          await this.options.store.updateSendLog(log.id, {
            status: 'failed',
            error_class:
              error instanceof Error
                ? error.constructor.name.slice(0, 80)
                : 'unknown',
          });
          counts.failed += 1;
        }
      } else {
        await this.options.store.updateSendLog(log.id, { status: 'sent' });
        counts.sent += 1;
      }
    }

    if (counts.sent > 0) {
      await this.options.store.updateRun(run.id, {
        sends_count: run.sends_count + counts.sent,
        current_step: Math.max(run.current_step, step.step_order),
      });
    }
    return counts;
  }

  private recipientForRole(
    role: RecipientRole,
    settings: MessagingSettings,
    contract: ContractFacts | null,
    client: Awaited<ReturnType<ReminderStore['loadClientFacts']>>
  ): string | null {
    switch (role) {
      case 'client':
        return contract?.clientEmail || client?.email || null;
      case 'doula':
        return contract?.doulaEmail || client?.doulaEmail || null;
      case 'admin':
        return settings.admin_notification_email;
      case 'billing':
        return settings.billing_notification_email;
      default:
        return null;
    }
  }

  private async buildMergeContext(
    run: ReminderRun,
    policy: PolicyWithSteps,
    contract: ContractFacts | null,
    client: Awaited<ReturnType<ReminderStore['loadClientFacts']>>,
    settings: MessagingSettings,
    extras: MergeContext
  ): Promise<MergeContext> {
    const frontend = this.options.frontendUrl || DEFAULT_FRONTEND;
    const signingLink =
      run.contract_id && run.client_id
        ? await this.options.store.mintSigningLink(
            run.contract_id,
            run.client_id
          )
        : null;
    const daysSinceNote =
      client?.lastNoteAt != null
        ? String(
            Math.floor(
              (this.now().getTime() - client.lastNoteAt.getTime()) /
                (24 * 60 * 60 * 1000)
            )
          )
        : '';
    const remaining =
      client?.contractedHours != null
        ? Math.max(0, client.contractedHours - (client.postpartumHours || 0))
        : null;
    return {
      client_first_name:
        client?.firstName || contract?.clientFirstName || 'there',
      client_last_name: client?.lastName || contract?.clientLastName || '',
      doula_name: client?.doulaName || contract?.doulaName || 'your doula',
      signing_link: signingLink || '',
      contract_sent_date: contract?.sentAt
        ? formatDateUtc(contract.sentAt)
        : formatDateUtc(run.anchor_at),
      cancel_date: formatDateUtc(this.cancelDate(policy, run.anchor_at)),
      contact_email: settings.contact_email,
      restart_date: extras.restart_date || '',
      postponement_reason: extras.postponement_reason || '',
      crm_link: `${frontend.replace(/\/+$/, '')}/clients/${run.client_id || ''}`,
      days_since_last_note: daysSinceNote,
      due_date: client?.dueDate ? formatDateUtc(client.dueDate) : '',
      evaluation_link: settings.evaluation_link || '',
      hours_remaining: remaining != null ? String(remaining) : '',
      hours_contracted:
        client?.contractedHours != null ? String(client.contractedHours) : '',
      ...extras,
    };
  }

  private async maybeAlertAfterSends(
    run: ReminderRun,
    policy: PolicyWithSteps
  ): Promise<void> {
    if (!policy.alert_admin_after_sends || run.admin_alerted) return;
    if (run.sends_count >= policy.alert_admin_after_sends) {
      await this.options.store.createAlert({
        type: `${policy.key}_admin_after_sends`,
        client_id: run.client_id,
        contract_id: run.contract_id,
        run_id: run.id,
        message: `Admin alert: ${policy.name} reached ${policy.alert_admin_after_sends} sends.`,
      });
      await this.options.store.updateRun(run.id, { admin_alerted: true });
    }
  }

  private async scheduleNext(
    run: ReminderRun,
    policy: PolicyWithSteps,
    now: Date
  ): Promise<void> {
    let next: Date | null = null;
    for (const step of policy.steps.filter((s) => s.enabled)) {
      const firstDue = addDelay(
        run.anchor_at,
        step.delay_value,
        step.delay_unit
      );
      const sent = await this.options.store.countSendsForRunStep(
        run.id,
        step.step_order,
        ['sent', 'pending', 'test']
      );
      if (sent === 0) {
        if (!next || firstDue.getTime() < next.getTime()) next = firstDue;
        continue;
      }
      if (step.repeat_every_value && step.repeat_every_unit) {
        const repeatDue = addDelay(
          firstDue,
          sent * step.repeat_every_value,
          step.repeat_every_unit as DelayUnit
        );
        if (!next || repeatDue.getTime() < next.getTime()) next = repeatDue;
      }
    }
    const endDue = run.end_action_due_at;
    if (endDue && (!next || endDue.getTime() < next.getTime())) {
      next = endDue;
    }
    const stillWaiting = next && next.getTime() > now.getTime();
    const hasRepeat = policy.steps.some(
      (s) => s.enabled && s.repeat_every_value && s.repeat_every_unit
    );
    if (!stillWaiting && !hasRepeat && !endDue) {
      await this.options.store.updateRun(run.id, {
        status: 'completed',
        completed_reason: 'sequence_complete',
        next_due_at: null,
      });
      return;
    }
    await this.options.store.updateRun(run.id, {
      next_due_at: next,
    });
  }

  private async applyEndAction(
    run: ReminderRun,
    policy: PolicyWithSteps,
    contract: ContractFacts | null,
    settings: MessagingSettings
  ): Promise<{
    sent: number;
    skipped: number;
    failed: number;
    endActions: number;
  }> {
    const counts = { sent: 0, skipped: 0, failed: 0, endActions: 0 };
    if (policy.end_action === 'void_contract') {
      if (contract && isSignedContract(contract.status)) {
        if (contract.depositDue && !contract.depositPaid) {
          await this.options.store.createAlert({
            type: 'signed_deposit_unpaid',
            client_id: run.client_id,
            contract_id: run.contract_id,
            run_id: run.id,
            message: 'Signed, deposit not received',
          });
        }
        await this.options.store.updateRun(run.id, {
          status: 'completed',
          completed_reason: 'signed_never_void',
          next_due_at: null,
        });
        counts.endActions += 1;
        counts.skipped += 1;
        return counts;
      }

      if (contract && UNSIGNED_PENDING_STATUSES.has(contract.status)) {
        const voided = await this.options.store.voidUnsignedContract(
          contract.id
        );
        if (voided && voided.status === 'voided') {
          const cancelSends = await this.sendEndTemplates(
            run,
            policy,
            settings,
            contract
          );
          counts.sent += cancelSends.sent;
          counts.failed += cancelSends.failed;
          await this.options.store.createAlert({
            type: 'contract_auto_canceled',
            client_id: run.client_id,
            contract_id: run.contract_id,
            run_id: run.id,
            message: 'Unsigned contract auto-canceled at day 7.',
          });
          if (policy.notify_admin_email) {
            const adminSend = await this.sendAdminEndEmail(
              run,
              policy,
              settings
            );
            counts.sent += adminSend;
          }
        }
      }
    } else if (policy.end_action === 'admin_alert') {
      await this.options.store.createAlert({
        type: `${policy.key}_end`,
        client_id: run.client_id,
        contract_id: run.contract_id,
        run_id: run.id,
        message: `${policy.name} reached its end action.`,
      });
    }

    await this.options.store.updateRun(run.id, {
      status: 'completed',
      completed_reason: policy.end_action || 'stop',
      next_due_at: null,
    });
    counts.endActions += 1;
    return counts;
  }

  private async sendEndTemplates(
    run: ReminderRun,
    policy: PolicyWithSteps,
    settings: MessagingSettings,
    contract: ContractFacts
  ): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;
    const client = run.client_id
      ? await this.options.store.loadClientFacts(run.client_id)
      : null;
    const context = await this.buildMergeContext(
      run,
      policy,
      contract,
      client,
      settings,
      {}
    );
    for (const key of policy.end_action_template_keys) {
      const template = await this.options.store.getTemplateByKey(key);
      if (!template) continue;
      const idempotencyKey = `run:${run.id}:end:${key}:v${template.version}`;
      const log = await this.options.store.tryInsertSendLog({
        runId: run.id,
        policyKey: policy.key,
        stepOrder: null,
        templateKey: template.key,
        templateVersion: template.version,
        idempotencyKey,
        recipientRole: 'client',
        recipientEmail: contract.clientEmail,
        channel: 'email',
        status: 'pending',
      });
      if (log === 'duplicate') continue;
      const to = settings.test_recipient_override_email || contract.clientEmail;
      if (!to) {
        await this.options.store.updateSendLog(log.id, {
          status: 'skipped',
          suppress_reason: 'missing_recipient',
        });
        continue;
      }
      const rendered = await this.renderTemplate(template.id, context);
      if (!rendered) continue;
      try {
        await this.options.mailer.sendEmail(
          to,
          rendered.subject,
          rendered.text,
          rendered.html
        );
        await this.options.store.updateSendLog(log.id, { status: 'sent' });
        sent += 1;
      } catch {
        await this.options.store.updateSendLog(log.id, {
          status: 'failed',
          error_class: 'Error',
        });
        failed += 1;
      }
    }
    return { sent, failed };
  }

  private async sendAdminEndEmail(
    run: ReminderRun,
    policy: PolicyWithSteps,
    settings: MessagingSettings
  ): Promise<number> {
    const to =
      settings.test_recipient_override_email ||
      settings.admin_notification_email;
    if (!to) return 0;
    const key = `run:${run.id}:end:admin_email:v1`;
    const log = await this.options.store.tryInsertSendLog({
      runId: run.id,
      policyKey: policy.key,
      stepOrder: null,
      templateKey: 'admin_end_action',
      templateVersion: 1,
      idempotencyKey: key,
      recipientRole: 'admin',
      recipientEmail: to,
      channel: 'email',
      status: 'pending',
    });
    if (log === 'duplicate') return 0;
    await this.options.mailer.sendEmail(
      to,
      `${policy.name} end action`,
      `A reminder policy end action ran for contract ${run.contract_id || ''}.`
    );
    await this.options.store.updateSendLog(log.id, { status: 'sent' });
    return 1;
  }

  private async autoRestartPostponements(): Promise<number> {
    const due = await this.options.store.listDuePostponementRestarts(
      this.now()
    );
    let count = 0;
    for (const postponement of due) {
      await this.restartFromPostponement(postponement.id, 'auto');
      count += 1;
    }
    return count;
  }

  async restartFromPostponement(
    postponementId: string,
    source: 'auto' | 'lift'
  ): Promise<void> {
    const postponement =
      await this.options.store.getPostponement(postponementId);
    if (!postponement) return;
    const restartAt = source === 'lift' ? this.now() : postponement.restart_at;
    const runs = (
      await this.options.store.listRuns({
        clientId: postponement.client_id,
        pageSize: 100,
      })
    ).rows.filter(
      (run) =>
        run.status === 'paused' &&
        (!postponement.contract_id ||
          !run.contract_id ||
          run.contract_id === postponement.contract_id)
    );

    for (const run of runs) {
      const policy = await this.options.store.getPolicy(run.policy_id);
      if (!policy) continue;
      const dues = this.computeSchedule(policy, restartAt);
      await this.options.store.updateRun(run.id, {
        status: 'active',
        anchor_at: restartAt,
        current_step: 1,
        next_due_at: dues.nextDueAt,
        end_action_due_at: dues.endActionDueAt,
        pause_reason: null,
        sends_count: 0,
        admin_alerted: false,
      });
    }

    await this.options.store.updatePostponement(postponementId, {
      status: source === 'lift' ? 'lifted' : 'restarted',
    });
    await this.options.store.appendPostponementEvent({
      postponement_id: postponementId,
      event_type: source === 'lift' ? 'lifted' : 'auto_restarted',
      actor_id: null,
      payload: { restart_at: restartAt.toISOString() },
    });
    await this.options.store.createAlert({
      type: 'postponement_restarted',
      client_id: postponement.client_id,
      contract_id: postponement.contract_id,
      run_id: null,
      message: `Postponement ${source === 'lift' ? 'lifted' : 'auto-restarted'}; signing window restarted.`,
    });
  }

  private async runScans(settings: MessagingSettings): Promise<number> {
    let started = 0;
    const now = this.now();
    const overduePolicy =
      await this.options.store.getPolicyByKey('overdue_notes');
    if (overduePolicy?.enabled) {
      const days =
        overduePolicy.config.overdue_days ?? settings.overdue_days ?? 7;
      const clients = await this.options.store.listOverdueNoteClients(
        days,
        now
      );
      for (const client of clients) {
        const run = await this.startRun({
          policyKey: 'overdue_notes',
          subjectType: 'client',
          subjectId: client.id,
          clientId: client.id,
          doulaId: client.doulaId,
          anchorAt: now,
        });
        if (run) started += 1;
      }
    }

    const birthPolicy =
      await this.options.store.getPolicyByKey('birth_outcomes');
    if (birthPolicy?.enabled) {
      const daysAfter = birthPolicy.config.days_after_due_date ?? 5;
      const dueClients = await this.options.store.listDueDateScanClients(
        daysAfter,
        now
      );
      const delivered = await this.options.store.listBabyDeliveredClients(now);
      const unique = new Map(
        [...dueClients, ...delivered].map((c) => [c.id, c])
      );
      for (const client of unique.values()) {
        const anchor = client.dueDate
          ? addDelay(client.dueDate, daysAfter, 'days')
          : now;
        const run = await this.startRun({
          policyKey: 'birth_outcomes',
          subjectType: 'client',
          subjectId: client.id,
          clientId: client.id,
          doulaId: client.doulaId,
          anchorAt:
            client.babyDeliveredAt && client.babyDeliveredAt < anchor
              ? client.babyDeliveredAt
              : anchor,
        });
        if (run) started += 1;
      }
    }

    const hoursPolicy = await this.options.store.getPolicyByKey(
      'postpartum_hours_low'
    );
    if (hoursPolicy?.enabled) {
      const clients = await this.options.store.listHoursLowClients(
        hoursPolicy.config.remaining_hours_threshold ?? 4,
        hoursPolicy.config.remaining_pct ?? 20
      );
      for (const client of clients) {
        const run = await this.startRun({
          policyKey: 'postpartum_hours_low',
          subjectType: 'client',
          subjectId: `${client.id}:hours-low`,
          clientId: client.id,
          doulaId: client.doulaId,
          anchorAt: now,
          processImmediately: true,
        });
        if (run) started += 1;
      }
    }

    const cardPolicy =
      await this.options.store.getPolicyByKey('card_not_on_file');
    if (cardPolicy?.enabled) {
      const clients = await this.options.store.listCardMissingAfterDeposit();
      for (const client of clients) {
        const run = await this.startRun({
          policyKey: 'card_not_on_file',
          subjectType: 'client',
          subjectId: `${client.id}:card-missing`,
          clientId: client.id,
          doulaId: client.doulaId,
          anchorAt: now,
          processImmediately: true,
        });
        if (run) started += 1;
      }
    }

    return started;
  }
}
