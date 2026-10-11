import { contractNotifications } from '../../config/env';
import { NodemailerService } from '../../services/emailService';
import { PostponementService } from './application/postponementService';
import { ReminderEngine } from './application/reminderEngine';
import {
  ReminderDomainEvent,
  registerReminderEventHandler,
} from './application/reminderHooks';
import { createAdminMessagingRoutes } from './http/adminMessagingRoutes';
import { createDoulaMessagingRoutes } from './http/doulaMessagingRoutes';
import { createReminderTickRoutes } from './http/tickRoutes';
import { CloudSqlReminderStore } from './infrastructure/cloudSqlReminderStore';

const testToolsEnabled = process.env.REMINDER_TEST_TOOLS_ENABLED === 'true';

function createMailer() {
  const email = new NodemailerService();
  return {
    sendEmail: (to: string, subject: string, text: string, html?: string) =>
      email.sendEmail(to, subject, text, html),
  };
}

export function createMessagingFeature(
  deps: {
    voidContract?: (contractId: string) => Promise<void>;
    mintSigningLink?: (
      contractId: string,
      clientId: string
    ) => Promise<string | null>;
  } = {}
) {
  const store = new CloudSqlReminderStore(deps);
  const engine = new ReminderEngine({
    store,
    mailer: createMailer(),
    frontendUrl: contractNotifications.frontendUrl,
    testToolsEnabled,
  });
  const postponements = new PostponementService(store, engine);
  registerReminderEventHandler((event) => handleMessagingEvent(engine, event));
  return {
    store,
    engine,
    postponements,
    adminRoutes: createAdminMessagingRoutes({
      store,
      engine,
      postponements,
      testToolsEnabled,
    }),
    doulaRoutes: createDoulaMessagingRoutes(postponements),
    tickRoutes: createReminderTickRoutes(engine),
  };
}

export async function handleMessagingEvent(
  engine: ReminderEngine,
  event: ReminderDomainEvent
): Promise<void> {
  const now = engine.now();
  switch (event.type) {
    case 'contract_sent':
      await engine.startRun({
        policyKey: 'contract_signing',
        subjectType: 'contract',
        subjectId: event.contractId,
        clientId: event.clientId,
        contractId: event.contractId,
        anchorAt: event.sentAt,
      });
      return;
    case 'activity_created': {
      const type = String(event.activityType || '').toLowerCase();
      if (type.includes('interview')) {
        await engine.startRun({
          policyKey: 'doula_interview_logged',
          subjectType: 'activity',
          subjectId: `${event.clientId}:${now.toISOString()}`,
          clientId: event.clientId,
          anchorAt: now,
          processImmediately: true,
        });
      }
      if (String(event.createdByRole || '').toLowerCase() === 'admin') {
        await engine.startRun({
          policyKey: 'admin_note_added',
          subjectType: 'activity',
          subjectId: `${event.clientId}:admin-note:${now.toISOString()}`,
          clientId: event.clientId,
          anchorAt: now,
          processImmediately: true,
        });
      }
      return;
    }
    case 'hours_logged':
      await engine.startRun({
        policyKey: 'postpartum_hours_low',
        subjectType: 'client',
        subjectId: `${event.clientId}:hours-low`,
        clientId: event.clientId,
        doulaId: event.doulaId,
        anchorAt: now,
        processImmediately: true,
      });
      return;
    case 'headshot_updated':
      await engine.startRun({
        policyKey: 'headshot_updated',
        subjectType: 'doula',
        subjectId: event.doulaId,
        anchorAt: now,
        processImmediately: true,
      });
      return;
    case 'client_status_changed':
      if (String(event.status).toLowerCase() === 'complete') {
        await engine.startRun({
          policyKey: 'service_completed_evaluation',
          subjectType: 'client_completion',
          subjectId: `${event.clientId}:${now.toISOString()}`,
          clientId: event.clientId,
          anchorAt: now,
          processImmediately: true,
        });
      }
      return;
    case 'birth_outcomes_recorded':
      await engine.completeSubjectRuns(
        'birth_outcomes',
        'client',
        event.clientId,
        'birth_outcomes_recorded'
      );
      return;
    case 'evaluation_received':
      await engine.startRun({
        policyKey: 'evaluation_received',
        subjectType: 'evaluation',
        subjectId: `${event.clientId}:${now.toISOString()}`,
        clientId: event.clientId,
        anchorAt: now,
        processImmediately: true,
      });
      return;
    case 'deposit_paid_no_card':
      await engine.startRun({
        policyKey: 'card_not_on_file',
        subjectType: 'client',
        subjectId: `${event.clientId}:card-missing`,
        clientId: event.clientId,
        contractId: event.contractId,
        anchorAt: now,
        processImmediately: true,
      });
      return;
    case 'baby_delivered':
      await engine.startRun({
        policyKey: 'birth_outcomes',
        subjectType: 'client',
        subjectId: event.clientId,
        clientId: event.clientId,
        anchorAt: now,
      });
      return;
    default:
      return;
  }
}

let singleton: ReturnType<typeof createMessagingFeature> | null = null;

export function getMessagingFeature(): ReturnType<
  typeof createMessagingFeature
> {
  if (!singleton) singleton = createMessagingFeature();
  return singleton;
}

export const messagingAdminRoutes = {
  get stack() {
    return getMessagingFeature().adminRoutes;
  },
};
