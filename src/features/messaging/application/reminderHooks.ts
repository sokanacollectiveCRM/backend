import { logger } from '../../../common/utils/logger';

export type ReminderDomainEvent =
  | {
      type: 'contract_sent';
      contractId: string;
      clientId: string;
      sentAt: Date;
      signingUrl: string;
      resend?: boolean;
    }
  | {
      type: 'activity_created';
      clientId: string;
      activityType: string;
      createdByRole?: string | null;
    }
  | {
      type: 'hours_logged';
      clientId: string;
      doulaId: string;
      hourType?: string | null;
    }
  | { type: 'headshot_updated'; doulaId: string }
  | { type: 'client_status_changed'; clientId: string; status: string }
  | { type: 'birth_outcomes_recorded'; clientId: string }
  | { type: 'evaluation_received'; clientId: string }
  | { type: 'deposit_paid_no_card'; clientId: string; contractId?: string }
  | { type: 'baby_delivered'; clientId: string };

type Handler = (event: ReminderDomainEvent) => Promise<void>;

let handler: Handler | null = null;

export function registerReminderEventHandler(next: Handler | null): void {
  handler = next;
}

export function emitReminderEvent(event: ReminderDomainEvent): void {
  if (!handler) return;
  void handler(event).catch(() => {
    logger.warn(
      { operation: 'reminder_hook', eventType: event.type },
      'Reminder hook failed'
    );
  });
}
