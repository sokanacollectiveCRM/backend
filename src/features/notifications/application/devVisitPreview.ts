import type {
  VisitRecipientRole,
  VisitReminderCandidate,
} from '../domain/visitReminders';
import {
  NotificationEmail,
  buildVisitReminderEmail,
} from '../infrastructure/notificationEmail';
import { NotificationStore } from '../infrastructure/notificationStore';
import { runVisitReminders } from './runVisitReminders';

export function devVisitPreviewAllowed(
  tenantId: string | undefined,
  env = process.env
): boolean {
  return (
    env.K_SERVICE === 'sokana-private-api-dev' &&
    env.CLOUD_SQL_DATABASE === 'sokana_private_dev' &&
    Boolean(env.NOTIFICATION_DEV_TEST_TENANT_ID) &&
    tenantId === env.NOTIFICATION_DEV_TEST_TENANT_ID
  );
}

/** Explicitly configured fictional tenant only; SMTP is never used. Preview keys
 * are separate from live deliveries, so a preview cannot suppress a real reminder. */
export async function previewVisitReminders(
  bookingId: string,
  tenantId: string,
  now: Date
) {
  const previews: Array<{
    role: VisitRecipientRole;
    subject: string;
    text: string;
    html: string;
  }> = [];
  class PreviewEmail extends NotificationEmail {
    override async sendVisitReminder(
      row: VisitReminderCandidate,
      role: VisitRecipientRole,
      at: Date
    ): Promise<void> {
      previews.push({ role, ...buildVisitReminderEmail(row, role, at) });
    }
  }
  class PreviewStore extends NotificationStore {
    override claimVisit(input: Parameters<NotificationStore['claimVisit']>[0]) {
      return super.claimVisit({
        ...input,
        dedupeKey: `preview:${input.dedupeKey}`,
        role: `preview_${input.role}`,
      });
    }
    override markDelivery(key: string, status: 'sent' | 'skipped' | 'failed') {
      return super.markDelivery(`preview:${key}`, status);
    }
    override releaseClaim(key: string) {
      return super.releaseClaim(`preview:${key}`);
    }
  }
  const result = await runVisitReminders(
    now,
    new PreviewStore(),
    new PreviewEmail(),
    { bookingId, tenantId }
  );
  return { previewOnly: true, ...result, previews };
}
