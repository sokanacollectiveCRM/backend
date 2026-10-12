import { logger } from '../../../common/utils/logger';
import { addDelay, formatMergeDate, windowStartIso } from '../domain/delay';
import { htmlFromText, renderTemplate } from '../domain/mergeFields';
import {
  ClientFacts,
  ContractFacts,
  DelayUnit,
  MergeContext,
  MessagingEvent,
  MessagingSettings,
  RecipientRole,
  ReminderPolicy,
  ReminderPolicyStep,
  ReminderRun,
  TickCounts,
} from '../domain/types';
import {
  evaluateStopReason,
  isSigned,
  isUnsignedPending,
} from './stopConditions';
import { MessagingStore, UniqueViolationError } from './store';

export interface ReminderEmailSender {
  sendEmail(
    to: string,
    subject: string,
    text: string,
    html?: string
  ): Promise<void>;
}

export interface ContractVoider {
  voidIfUnsigned(
    contractId: string,
    reason: string
  ): Promise<'voided' | 'skipped_signed' | 'not_found' | 'invalid_status'>;
}

export interface SigningLinkIssuer {
  issue(contractId: string, clientId: string): Promise<string | null>;
}

export interface ReminderClock {
  now(): Date;
}

const DEFAULT_CRM_LINK = 'https://sokana-front-end-dev-46lcr3n2qa-uc.a.run.app';

export class ReminderEngine {
  constructor(
    private readonly store: MessagingStore,
    private readonly email: ReminderEmailSender,
    private readonly voids: ContractVoider,
    private readonly signingLinks: SigningLinkIssuer,
    private readonly clock: ReminderClock = { now: () => new Date() },
    private readonly frontendUrl: string = process.env.FRONTEND_URL ||
      DEFAULT_CRM_LINK
  ) {}

  async tick(): Promise<TickCounts> {
    const settings = await this.store.getSettings();
    if (!settings.remindersEnabled) {
      logger.info(
        { service: 'messaging', operation: 'tick', suppressed: true },
        'Reminder kill switch off; tick suppressed'
      );
      return {
        suppressed: true,
        claimed: 0,
        sent: 0,
        skipped: 0,
        failed: 0,
        endActions: 0,
        postponedRestarted: 0,
        scansStarted: 0,
      };
    }

    const now = this.clock.now();
    const counts: TickCounts = {
      claimed: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      endActions: 0,
      postponedRestarted: 0,
      scansStarted: 0,
    };

    counts.postponedRestarted = await this.autoRestartPostponements(
      now,
      settings
    );

    const claimed = await this.store.claimDueRuns(now, 50);
    counts.claimed = claimed.length;
    for (const run of claimed) {
      try {
        const result = await this.processRun(run, settings, now);
        counts.sent += result.sent;
        counts.skipped += result.skipped;
        counts.failed += result.failed;
        counts.endActions += result.endActions;
      } catch (error) {
        counts.failed += 1;
        logger.warn(
          {
            service: 'messaging',
            operation: 'process_run',
            runId: run.id,
            errorClass: error instanceof Error ? error.name : 'Error',
          },
          'Failed to process reminder run'
        );
      }
    }

    counts.scansStarted = await this.runScans(now);
    return counts;
  }

  async handleEvent(event: MessagingEvent): Promise<ReminderRun | null> {
    const settings = await this.store.getSettings();
    switch (event.type) {
      case 'contract_sent':
        return this.onContractSent(event, settings);
      case 'baby_delivered':
        return this.startClientPolicy(
          'birth_outcomes',
          event.clientId,
          settings,
          {
            anchorAt: this.clock.now(),
          }
        );
      case 'birth_outcomes_recorded':
        await this.completeClientPolicy(
          'birth_outcomes',
          event.clientId,
          'birth_outcomes_recorded'
        );
        return null;
      case 'note_created':
        await this.completeClientPolicy(
          'overdue_notes',
          event.clientId,
          'note_created'
        );
        if (event.createdByRole === 'admin') {
          return this.startImmediate(
            'admin_note_added',
            event.clientId,
            'client',
            settings
          );
        }
        if (/interview/i.test(event.activityType || '')) {
          return this.startImmediate(
            'doula_interview_logged',
            event.clientId,
            'client',
            settings
          );
        }
        return null;
      case 'headshot_updated':
        return this.startImmediate(
          'headshot_updated',
          event.doulaId,
          'doula',
          settings
        );
      case 'client_completed':
        return this.startImmediate(
          'service_completed_evaluation',
          event.clientId,
          'client',
          settings
        );
      case 'evaluation_received':
        return this.startImmediate(
          'evaluation_received',
          event.clientId,
          'client',
          settings
        );
      case 'hours_logged':
        return this.startImmediate(
          'postpartum_hours_low',
          event.clientId,
          'client',
          settings,
          { requireHoursLow: true }
        );
      case 'deposit_paid_no_card':
        return this.startImmediate(
          'card_not_on_file',
          event.clientId,
          'client',
          settings
        );
      case 'postponement_event':
        return this.startImmediate(
          'postponement_notice',
          event.clientId,
          'client',
          settings,
          { contractId: event.contractId ?? null }
        );
      default:
        return null;
    }
  }

  async renderContractSentInitial(input: {
    contractId: string;
    clientId: string;
    signingUrl: string;
    sentAt: Date;
  }): Promise<{
    subject: string;
    text: string;
    html: string;
    cancelDate: string;
  } | null> {
    const policy = await this.store.getPolicyByKey('contract_signing');
    const template = await this.store.getTemplateByKey('contract_sent_initial');
    const settings = await this.store.getSettings();
    const facts = await this.store.getContractFacts(input.contractId);
    if (!policy || !template) return null;
    const cancelAt = this.endActionAt(policy, input.sentAt);
    const context = await this.mergeContext({
      settings,
      contract: facts,
      signingUrl: input.signingUrl,
      sentAt: input.sentAt,
      cancelAt,
    });
    const text = renderTemplate(template.bodyText, context);
    return {
      subject: renderTemplate(template.subject, context),
      text,
      html: template.bodyHtml
        ? renderTemplate(template.bodyHtml, context)
        : htmlFromText(text),
      cancelDate: formatMergeDate(cancelAt),
    };
  }

  async stopContractReminders(
    contractId: string,
    actorId: string,
    reason?: string
  ): Promise<void> {
    await this.store.upsertContractOverride({
      contractId,
      stopped: true,
      reason: reason ?? 'stopped_by_admin',
      updatedBy: actorId,
      updatedAt: this.clock.now(),
    });
    const runs = await this.store.listRuns({ contractId });
    for (const run of runs) {
      if (run.status === 'active' || run.status === 'paused') {
        await this.store.updateRun(run.id, {
          status: 'stopped_by_admin',
          completedReason: reason ?? 'stopped_by_admin',
        });
      }
    }
  }

  async resumeContractReminders(
    contractId: string,
    actorId: string
  ): Promise<void> {
    const now = this.clock.now();
    await this.store.upsertContractOverride({
      contractId,
      stopped: false,
      reason: null,
      updatedBy: actorId,
      updatedAt: now,
    });
    const runs = await this.store.listRuns({
      contractId,
      status: 'stopped_by_admin',
    });
    for (const run of runs) {
      const policy = await this.store.getPolicyById(run.policyId);
      if (!policy || !policy.enabled) continue;
      const firstReminder = this.firstTickStep(policy);
      await this.store.updateRun(run.id, {
        status: 'active',
        anchorAt: now,
        currentStep: firstReminder?.stepOrder ?? 1,
        nextDueAt: firstReminder
          ? addDelay(now, firstReminder.delayValue, firstReminder.delayUnit)
          : now,
        endActionDueAt: this.endActionAt(policy, now),
        pauseReason: null,
        completedReason: null,
        sendsCount: 0,
      });
    }
  }

  async advanceRun(runId: string): Promise<ReminderRun> {
    const now = this.clock.now();
    return this.store.updateRun(runId, {
      nextDueAt: now,
      endActionDueAt: now,
    });
  }

  private async onContractSent(
    event: Extract<MessagingEvent, { type: 'contract_sent' }>,
    settings: MessagingSettings
  ): Promise<ReminderRun | null> {
    const policy = await this.store.getPolicyByKey('contract_signing');
    if (!policy || !policy.enabled) return null;
    const facts = await this.store.getContractFacts(event.contractId);
    if (facts?.remindersStopped) return null;

    if (event.isResend && policy.config.reset_anchor_on_resend !== true) {
      const existing = await this.store.findOpenRun(
        policy.id,
        'contract',
        event.contractId
      );
      return existing;
    }

    const postponement = await this.store.findActivePostponement({
      contractId: event.contractId,
      clientId: event.clientId,
    });
    const firstTick = this.firstTickStep(policy);
    const run = await this.store.createRun({
      policyId: policy.id,
      policyKey: policy.key,
      subjectType: 'contract',
      subjectId: event.contractId,
      clientId: event.clientId,
      contractId: event.contractId,
      doulaId: facts?.doulaId ?? null,
      status: postponement ? 'paused' : 'active',
      anchorAt: event.sentAt,
      currentStep: 0,
      nextDueAt: firstTick
        ? addDelay(event.sentAt, firstTick.delayValue, firstTick.delayUnit)
        : this.endActionAt(policy, event.sentAt),
      endActionDueAt: this.endActionAt(policy, event.sentAt),
      sendsCount: 0,
      pauseReason: postponement ? 'postponement' : null,
      completedReason: null,
    });

    return run;
  }

  private async startImmediate(
    policyKey: string,
    subjectId: string,
    subjectType: 'client' | 'doula',
    settings: MessagingSettings,
    options?: {
      contractId?: string | null;
      requireHoursLow?: boolean;
      anchorAt?: Date;
    }
  ): Promise<ReminderRun | null> {
    const policy = await this.store.getPolicyByKey(policyKey);
    if (!policy || !policy.enabled) return null;
    if (options?.requireHoursLow) {
      const client = await this.store.getClientFacts(subjectId);
      if (!client || !this.isHoursLow(client, policy)) return null;
    }
    return this.startAndMaybeSend(policy, subjectId, subjectType, settings, {
      contractId: options?.contractId,
      anchorAt: options?.anchorAt,
    });
  }

  private async startClientPolicy(
    policyKey: string,
    clientId: string,
    settings: MessagingSettings,
    options?: { anchorAt?: Date }
  ): Promise<ReminderRun | null> {
    const policy = await this.store.getPolicyByKey(policyKey);
    if (!policy || !policy.enabled) return null;
    const client = await this.store.getClientFacts(clientId);
    if (!client) return null;
    if (policyKey === 'birth_outcomes' && client.birthOutcomesRecorded) {
      return null;
    }
    return this.startAndMaybeSend(
      policy,
      clientId,
      'client',
      settings,
      options
    );
  }

  private async startAndMaybeSend(
    policy: ReminderPolicy,
    subjectId: string,
    subjectType: string,
    settings: MessagingSettings,
    options?: { contractId?: string | null; anchorAt?: Date }
  ): Promise<ReminderRun | null> {
    const now = options?.anchorAt ?? this.clock.now();
    const clientId = subjectType === 'client' ? subjectId : null;
    const postponement = await this.store.findActivePostponement({
      clientId,
      contractId: options?.contractId,
    });
    const first =
      this.firstTickStep(policy) ?? policy.steps.find((s) => s.enabled);
    const run = await this.store.createRun({
      policyId: policy.id,
      policyKey: policy.key,
      subjectType,
      subjectId,
      clientId,
      contractId: options?.contractId ?? null,
      doulaId: null,
      status: postponement ? 'paused' : 'active',
      anchorAt: now,
      currentStep: first?.stepOrder ?? 0,
      nextDueAt: first ? addDelay(now, first.delayValue, first.delayUnit) : now,
      endActionDueAt: this.endActionAt(policy, now),
      sendsCount: 0,
      pauseReason: postponement ? 'postponement' : null,
      completedReason: null,
    });
    if (postponement) return run;
    if (run.nextDueAt && run.nextDueAt.getTime() <= now.getTime()) {
      await this.processRun(run, settings, now);
    }
    return run;
  }

  private async completeClientPolicy(
    policyKey: string,
    clientId: string,
    reason: string
  ): Promise<void> {
    const policy = await this.store.getPolicyByKey(policyKey);
    if (!policy) return;
    const run = await this.store.findOpenRun(policy.id, 'client', clientId);
    if (!run) return;
    await this.store.updateRun(run.id, {
      status: 'completed',
      completedReason: reason,
      nextDueAt: null,
    });
  }

  private async processRun(
    run: ReminderRun,
    settings: MessagingSettings,
    now: Date
  ): Promise<{
    sent: number;
    skipped: number;
    failed: number;
    endActions: number;
  }> {
    const result = { sent: 0, skipped: 0, failed: 0, endActions: 0 };
    const policy = await this.store.getPolicyById(run.policyId);
    if (!policy || !policy.enabled) {
      await this.store.updateRun(run.id, {
        status: 'canceled',
        completedReason: 'policy_disabled',
      });
      result.skipped += 1;
      return result;
    }

    const contract = run.contractId
      ? await this.store.getContractFacts(run.contractId)
      : null;
    const client = run.clientId
      ? await this.store.getClientFacts(run.clientId)
      : null;
    const stop = evaluateStopReason({ policy, run, contract, client });
    if (stop) {
      await this.store.updateRun(run.id, {
        status: 'completed',
        completedReason: stop,
        nextDueAt: null,
      });
      result.skipped += 1;
      return result;
    }

    if (run.endActionDueAt && run.endActionDueAt.getTime() <= now.getTime()) {
      const applied = await this.applyEndAction(
        run,
        policy,
        settings,
        contract,
        now
      );
      result.endActions += applied ? 1 : 0;
      return result;
    }

    const dueSteps = policy.steps.filter((step) => {
      if (!step.enabled) return false;
      if (policy.config.initial_via_event && step.stepOrder === 0) return false;
      const dueAt = addDelay(run.anchorAt, step.delayValue, step.delayUnit);
      return dueAt.getTime() <= now.getTime();
    });

    for (const step of dueSteps) {
      const sendResult = await this.sendStep(run, policy, step, settings, now);
      result.sent += sendResult.sent;
      result.skipped += sendResult.skipped;
      result.failed += sendResult.failed;
    }

    if (
      policy.alertAdminAfterSends &&
      run.sendsCount + result.sent >= policy.alertAdminAfterSends
    ) {
      const already = await this.store.listAlerts();
      const exists = already.some(
        (alert) =>
          alert.runId === run.id &&
          alert.type === `${policy.key}_admin_threshold`
      );
      if (!exists) {
        await this.store.createAlert({
          type: `${policy.key}_admin_threshold`,
          clientId: run.clientId,
          contractId: run.contractId,
          runId: run.id,
          message: `${policy.name}: admin alert after ${policy.alertAdminAfterSends} sends`,
        });
      }
    }

    const next = this.nextDue(run, policy, now);
    await this.store.updateRun(run.id, {
      currentStep: Math.max(
        run.currentStep,
        ...dueSteps.map((s) => s.stepOrder),
        0
      ),
      nextDueAt: next,
      sendsCount: run.sendsCount + result.sent,
      claimedUntil: null,
    });
    return result;
  }

  private async sendStep(
    run: ReminderRun,
    policy: ReminderPolicy,
    step: ReminderPolicyStep,
    settings: MessagingSettings,
    now: Date,
    extra?: { signingUrl?: string; markOnlyIfLogged?: boolean }
  ): Promise<{ sent: number; skipped: number; failed: number }> {
    const template = await this.store.getTemplateById(step.templateId);
    if (!template) return { sent: 0, skipped: 1, failed: 0 };
    const firstDue = addDelay(run.anchorAt, step.delayValue, step.delayUnit);
    const windowStart = windowStartIso(
      firstDue,
      now,
      step.repeatEveryValue,
      step.repeatEveryUnit
    );

    let sent = 0;
    let skipped = 0;
    let failed = 0;
    const contract = run.contractId
      ? await this.store.getContractFacts(run.contractId)
      : null;
    const client = run.clientId
      ? await this.store.getClientFacts(run.clientId)
      : null;
    let signingUrl = extra?.signingUrl ?? '';
    if (!signingUrl && contract && step.recipientRoles.includes('client')) {
      signingUrl =
        (await this.signingLinks.issue(contract.id, contract.clientId)) ?? '';
    }
    const cancelAt = this.endActionAt(policy, run.anchorAt);
    const context = await this.mergeContext({
      settings,
      contract,
      client,
      signingUrl,
      sentAt: contract?.sentAt ?? run.anchorAt,
      cancelAt,
    });

    for (const role of step.recipientRoles) {
      const idempotencyKey = `run:${run.id}:step:${step.stepOrder}:${windowStart}:v${template.version}:${role}`;
      const existing = await this.store.findSendLogByKey(idempotencyKey);
      if (existing && existing.status !== 'failed') {
        skipped += 1;
        continue;
      }
      const recipient = this.resolveRecipient(role, settings, contract, client);
      const override = settings.testRecipientOverrideEmail;
      const to = override || recipient;
      const channel = step.channel;
      const shouldEmail = channel === 'email' || channel === 'both';
      const subject = renderTemplate(template.subject, context);
      const text = renderTemplate(template.bodyText, context);
      const html = template.bodyHtml
        ? renderTemplate(template.bodyHtml, context)
        : htmlFromText(text);

      try {
        await this.store.insertSendLog({
          runId: run.id,
          policyKey: policy.key,
          stepOrder: step.stepOrder,
          templateKey: template.key,
          templateVersion: template.version,
          idempotencyKey,
          recipientRole: role,
          recipientEmail: to,
          channel,
          status: shouldEmail && to ? 'sent' : 'skipped',
          suppressReason: !shouldEmail
            ? 'dashboard_only'
            : !to
              ? 'missing_recipient'
              : override
                ? 'test_override'
                : null,
        });
      } catch (error) {
        if (
          error instanceof UniqueViolationError ||
          (error as { code?: string }).code === '23505'
        ) {
          skipped += 1;
          continue;
        }
        throw error;
      }

      if (shouldEmail && to) {
        try {
          await this.email.sendEmail(to, subject, text, html);
          sent += 1;
        } catch (error) {
          failed += 1;
          logger.warn(
            {
              service: 'messaging',
              operation: 'send',
              policyKey: policy.key,
              errorClass: error instanceof Error ? error.name : 'Error',
            },
            'Reminder email failed'
          );
        }
      } else {
        skipped += 1;
      }
    }
    return { sent, skipped, failed };
  }

  private async applyEndAction(
    run: ReminderRun,
    policy: ReminderPolicy,
    settings: MessagingSettings,
    contract: ContractFacts | null,
    now: Date
  ): Promise<boolean> {
    const key = `run:${run.id}:end_action:v1`;
    const existing = await this.store.findSendLogByKey(key);
    if (existing) return false;

    if (policy.endAction === 'void_contract' && contract) {
      if (isSigned(contract.status)) {
        if (contract.depositRequired && !contract.depositPaid) {
          await this.store.createAlert({
            type: 'signed_deposit_unpaid',
            clientId: contract.clientId,
            contractId: contract.id,
            runId: run.id,
            message: 'signed, deposit not received',
          });
          await this.tryLog(
            key,
            run,
            policy,
            'skipped',
            'signed_deposit_unpaid'
          );
          await this.store.updateRun(run.id, {
            status: 'completed',
            completedReason: 'signed_deposit_unpaid',
            nextDueAt: null,
            endActionDueAt: now,
          });
          return true;
        }
        await this.tryLog(key, run, policy, 'skipped', 'never_void_signed');
        await this.store.updateRun(run.id, {
          status: 'completed',
          completedReason: 'signed',
          nextDueAt: null,
        });
        return true;
      }

      if (!isUnsignedPending(contract.status)) {
        await this.tryLog(
          key,
          run,
          policy,
          'skipped',
          `status_${contract.status}`
        );
        await this.store.updateRun(run.id, {
          status: 'completed',
          completedReason: contract.status,
          nextDueAt: null,
        });
        return true;
      }

      const voided = await this.voids.voidIfUnsigned(
        contract.id,
        'unsigned_after_signing_window'
      );
      if (voided === 'skipped_signed') {
        await this.store.createAlert({
          type: 'signed_deposit_unpaid',
          clientId: contract.clientId,
          contractId: contract.id,
          runId: run.id,
          message: 'signed, deposit not received',
        });
        await this.tryLog(key, run, policy, 'skipped', 'never_void_signed');
        await this.store.updateRun(run.id, {
          status: 'completed',
          completedReason: 'signed_deposit_unpaid',
          nextDueAt: null,
        });
        return true;
      }

      for (const templateKey of policy.endActionTemplateKeys) {
        const template = await this.store.getTemplateByKey(templateKey);
        if (!template) continue;
        const cancelStep: ReminderPolicyStep = {
          id: 'end-action',
          policyId: policy.id,
          stepOrder: 99,
          delayValue: policy.endActionDelayValue ?? 0,
          delayUnit: (policy.endActionDelayUnit as DelayUnit) ?? 'days',
          repeatEveryValue: null,
          repeatEveryUnit: null,
          channel: 'email',
          recipientRoles: ['client'],
          templateId: template.id,
          enabled: true,
        };
        await this.sendStep(
          run,
          { ...policy, steps: [cancelStep] },
          cancelStep,
          settings,
          now
        );
      }

      await this.store.createAlert({
        type: 'contract_auto_canceled',
        clientId: contract.clientId,
        contractId: contract.id,
        runId: run.id,
        message: `Contract auto-canceled after unsigned window (${formatMergeDate(now)})`,
      });

      if (policy.notifyAdminEmail) {
        const subject = `Contract auto-canceled: ${contract.clientFirstName}`;
        const text = `A contract was auto-canceled because it was not signed. Contact: ${settings.contactEmail}`;
        await this.email.sendEmail(
          settings.adminNotificationEmail,
          subject,
          text
        );
      }

      await this.tryLog(key, run, policy, 'sent', null);
      await this.store.updateRun(run.id, {
        status: 'completed',
        completedReason: 'void_contract',
        nextDueAt: null,
      });
      return true;
    }

    if (policy.endAction === 'admin_alert') {
      await this.store.createAlert({
        type: `${policy.key}_end`,
        clientId: run.clientId,
        contractId: run.contractId,
        runId: run.id,
        message: `${policy.name} end action`,
      });
    }

    await this.tryLog(key, run, policy, 'sent', null);
    await this.store.updateRun(run.id, {
      status: 'completed',
      completedReason: policy.endAction,
      nextDueAt: null,
    });
    return true;
  }

  private async autoRestartPostponements(
    now: Date,
    settings: MessagingSettings
  ): Promise<number> {
    const due = await this.store.listActivePostponementsDue(now);
    let count = 0;
    for (const postponement of due) {
      await this.store.updatePostponement(postponement.id, {
        status: 'restarted',
      });
      await this.store.appendPostponementEvent({
        postponementId: postponement.id,
        eventType: 'auto_restarted',
        payload: { restartAt: postponement.restartAt.toISOString() },
      });
      const runs = await this.store.listRuns({
        clientId: postponement.clientId,
        status: 'paused',
      });
      for (const run of runs) {
        if (
          postponement.contractId &&
          run.contractId !== postponement.contractId
        ) {
          continue;
        }
        const policy = await this.store.getPolicyById(run.policyId);
        if (!policy) continue;
        const firstReminder = this.firstTickStep(policy);
        const anchor = postponement.restartAt;
        await this.store.updateRun(run.id, {
          status: 'active',
          anchorAt: anchor,
          currentStep: firstReminder?.stepOrder ?? 1,
          nextDueAt: firstReminder
            ? addDelay(
                anchor,
                firstReminder.delayValue,
                firstReminder.delayUnit
              )
            : anchor,
          endActionDueAt: this.endActionAt(policy, anchor),
          pauseReason: null,
          sendsCount: 0,
        });
      }
      await this.store.createAlert({
        type: 'postponement_restarted',
        clientId: postponement.clientId,
        contractId: postponement.contractId,
        message: `Postponement auto-restarted on ${formatMergeDate(postponement.restartAt)}`,
      });
      count += 1;
    }
    void settings;
    return count;
  }

  async restartRunsFromAnchor(
    clientId: string,
    contractId: string | null,
    anchor: Date
  ): Promise<void> {
    const runs = await this.store.listRuns({
      clientId,
      status: ['paused', 'active'],
    });
    for (const run of runs) {
      if (contractId && run.contractId && run.contractId !== contractId)
        continue;
      const policy = await this.store.getPolicyById(run.policyId);
      if (!policy) continue;
      const firstReminder = this.firstTickStep(policy);
      await this.store.updateRun(run.id, {
        status: 'active',
        anchorAt: anchor,
        currentStep: firstReminder?.stepOrder ?? 1,
        nextDueAt: firstReminder
          ? addDelay(anchor, firstReminder.delayValue, firstReminder.delayUnit)
          : anchor,
        endActionDueAt: this.endActionAt(policy, anchor),
        pauseReason: null,
        sendsCount: 0,
        completedReason: null,
      });
    }
  }

  private async runScans(now: Date): Promise<number> {
    let started = 0;
    const settings = await this.store.getSettings();
    const birth = await this.store.getPolicyByKey('birth_outcomes');
    if (birth?.enabled) {
      const days = Number(birth.config.days_after_due_date ?? 5);
      const clients = await this.store.listDueDateScanCandidates(now, days);
      for (const client of clients) {
        const run = await this.startClientPolicy(
          'birth_outcomes',
          client.id,
          settings,
          {
            anchorAt: addDelay(client.dueDate as Date, days, 'days'),
          }
        );
        if (run) started += 1;
      }
    }
    const notes = await this.store.getPolicyByKey('overdue_notes');
    if (notes?.enabled) {
      const days = Number(notes.config.overdue_days ?? 7);
      const clients = await this.store.listOverdueNoteCandidates(now, days);
      for (const client of clients) {
        const run = await this.startClientPolicy(
          'overdue_notes',
          client.id,
          settings
        );
        if (run) started += 1;
      }
    }
    const hours = await this.store.getPolicyByKey('postpartum_hours_low');
    if (hours?.enabled) {
      const threshold = Number(hours.config.remaining_hours_threshold ?? 4);
      const pct = Number(hours.config.remaining_pct ?? 20);
      const clients = await this.store.listHoursLowCandidates(threshold, pct);
      for (const client of clients) {
        const run = await this.startImmediate(
          'postpartum_hours_low',
          client.id,
          'client',
          settings
        );
        if (run) started += 1;
      }
    }
    const card = await this.store.getPolicyByKey('card_not_on_file');
    if (card?.enabled) {
      const clients = await this.store.listDepositPaidNoCardCandidates();
      for (const client of clients) {
        const run = await this.startImmediate(
          'card_not_on_file',
          client.id,
          'client',
          settings
        );
        if (run) started += 1;
      }
    }
    return started;
  }

  private firstTickStep(
    policy: ReminderPolicy
  ): ReminderPolicyStep | undefined {
    const steps = policy.steps
      .filter((s) => s.enabled)
      .sort((a, b) => a.stepOrder - b.stepOrder);
    if (policy.config.initial_via_event) {
      return steps.find((s) => s.stepOrder > 0);
    }
    return steps[0];
  }

  private endActionAt(policy: ReminderPolicy, anchor: Date): Date | null {
    if (policy.endActionDelayValue == null || !policy.endActionDelayUnit) {
      return null;
    }
    return addDelay(
      anchor,
      policy.endActionDelayValue,
      policy.endActionDelayUnit
    );
  }

  private nextDue(
    run: ReminderRun,
    policy: ReminderPolicy,
    now: Date
  ): Date | null {
    const candidates: Date[] = [];
    for (const step of policy.steps) {
      if (!step.enabled) continue;
      if (policy.config.initial_via_event && step.stepOrder === 0) continue;
      const firstDue = addDelay(run.anchorAt, step.delayValue, step.delayUnit);
      if (step.repeatEveryValue && step.repeatEveryUnit) {
        let cursor = firstDue;
        if (cursor.getTime() <= now.getTime()) {
          cursor = addDelay(now, step.repeatEveryValue, step.repeatEveryUnit);
        }
        candidates.push(cursor);
      } else if (firstDue.getTime() > now.getTime()) {
        candidates.push(firstDue);
      }
    }
    if (run.endActionDueAt && run.endActionDueAt.getTime() > now.getTime()) {
      candidates.push(run.endActionDueAt);
    }
    if (!candidates.length) return run.endActionDueAt;
    return candidates.reduce((min, d) =>
      d.getTime() < min.getTime() ? d : min
    );
  }

  private resolveRecipient(
    role: RecipientRole,
    settings: MessagingSettings,
    contract?: ContractFacts | null,
    client?: ClientFacts | null
  ): string | null {
    if (role === 'client') {
      return contract?.clientEmail || client?.email || null;
    }
    if (role === 'doula') {
      return contract?.doulaEmail || client?.doulaEmail || null;
    }
    if (role === 'admin') return settings.adminNotificationEmail;
    if (role === 'billing') return settings.billingNotificationEmail;
    return null;
  }

  private async mergeContext(input: {
    settings: MessagingSettings;
    contract?: ContractFacts | null;
    client?: ClientFacts | null;
    signingUrl?: string;
    sentAt?: Date | null;
    cancelAt?: Date | null;
  }): Promise<MergeContext> {
    const client = input.client;
    const contract = input.contract;
    const daysSince = client?.lastNoteAt
      ? String(
          Math.max(
            0,
            Math.floor(
              (this.clock.now().getTime() - client.lastNoteAt.getTime()) /
                (24 * 60 * 60 * 1000)
            )
          )
        )
      : '';
    const remaining =
      client?.hoursContracted != null
        ? String(
            Math.max(
              0,
              client.hoursContracted - (client.postpartumHoursLogged || 0)
            )
          )
        : '';
    return {
      client_first_name: contract?.clientFirstName || client?.firstName || '',
      client_last_name: contract?.clientLastName || client?.lastName || '',
      doula_name: contract?.doulaName || client?.doulaName || '',
      signing_link: input.signingUrl || '',
      contract_sent_date: formatMergeDate(input.sentAt),
      cancel_date: formatMergeDate(input.cancelAt),
      contact_email: input.settings.contactEmail,
      restart_date: '',
      postponement_reason: '',
      crm_link: `${this.frontendUrl.replace(/\/+$/, '')}/clients/${
        contract?.clientId || client?.id || ''
      }`,
      days_since_last_note: daysSince,
      due_date: formatMergeDate(client?.dueDate),
      evaluation_link: input.settings.evaluationLink || '',
      hours_remaining: remaining,
      hours_contracted:
        client?.hoursContracted != null ? String(client.hoursContracted) : '',
    };
  }

  private isHoursLow(client: ClientFacts, policy: ReminderPolicy): boolean {
    if (client.hoursContracted == null || client.hoursContracted <= 0)
      return false;
    const remaining = client.hoursContracted - client.postpartumHoursLogged;
    const threshold = Number(policy.config.remaining_hours_threshold ?? 4);
    const pct = Number(policy.config.remaining_pct ?? 20);
    return (
      remaining <= threshold ||
      (remaining / client.hoursContracted) * 100 <= pct
    );
  }

  private async tryLog(
    key: string,
    run: ReminderRun,
    policy: ReminderPolicy,
    status: 'sent' | 'skipped' | 'failed' | 'suppressed' | 'test',
    reason: string | null
  ): Promise<void> {
    try {
      await this.store.insertSendLog({
        runId: run.id,
        policyKey: policy.key,
        stepOrder: null,
        templateKey: policy.endActionTemplateKeys[0] ?? null,
        templateVersion: null,
        idempotencyKey: key,
        recipientRole: null,
        recipientEmail: null,
        channel: 'dashboard',
        status,
        suppressReason: reason,
      });
    } catch (error) {
      if (
        error instanceof UniqueViolationError ||
        (error as { code?: string }).code === '23505'
      ) {
        return;
      }
      throw error;
    }
  }
}
