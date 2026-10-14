import { logger } from '../../../common/utils/logger';
import { isRuleEnabled } from '../domain/catalog';
import { displayFirstName } from '../domain/names';
import { NotificationEmail } from '../infrastructure/notificationEmail';
import { NotificationStore } from '../infrastructure/notificationStore';

function clientUrl(clientId: string): string | null {
  const base = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
  return base ? `${base}/clients/${clientId}` : null;
}

export async function recordActivityNotice(input: {
  clientId: string;
  activityType: string;
  authorRole: string;
  activityId: string;
}): Promise<void> {
  if (process.env.NOTIFICATION_RULES_KILL_SWITCH === 'true') return;
  const store = new NotificationStore();
  if (await store.isKilled()) return;
  const first = displayFirstName(await store.clientFirstName(input.clientId));
  const type = input.activityType.trim().toLowerCase();

  if (type === 'note' && input.authorRole.toLowerCase() === 'admin') {
    if (!isRuleEnabled('event_admin_note')) return;
    const doula = await store.assignedDoula(input.clientId);
    if (!doula?.email) return;
    const key = `activity:${input.activityId}:admin-note`;
    const claimed = await store.claim({
      dedupeKey: key,
      ruleId: 'event_admin_note',
      channel: 'email_doula',
      subjectType: 'client',
      subjectId: input.clientId,
    });
    if (!claimed) return;
    try {
      await new NotificationEmail().sendAdminNoteToDoula({
        to: doula.email,
        clientFirstName: first,
        crmUrl: clientUrl(input.clientId),
      });
      await store.markDelivery(key, 'sent');
    } catch (error) {
      await store.markDelivery(key, 'failed');
      logger.error(
        {
          service: 'notification-rules',
          ruleId: 'event_admin_note',
          err: error instanceof Error ? error.name : 'Error',
        },
        'Admin note notice failed'
      );
    }
    return;
  }

  if (!isRuleEnabled('event_routine_update') || type === 'note') return;
  await store.upsertNotice({
    dedupeKey: `activity:${input.activityId}:routine`,
    audience: 'admin',
    clientId: input.clientId,
    severity: 'info',
    title: `Update for ${first}`,
    body: 'A routine client update was saved. No email was sent.',
    ruleId: 'event_routine_update',
  });
}

export async function recordHeadshotNotice(doulaId: string): Promise<void> {
  if (!isRuleEnabled('event_headshot')) return;
  if (process.env.NOTIFICATION_RULES_KILL_SWITCH === 'true') return;
  const store = new NotificationStore();
  if (await store.isKilled()) return;
  await store.upsertNotice({
    dedupeKey: `doula:${doulaId}:headshot:${Date.now()}`,
    audience: 'admin',
    doulaId,
    severity: 'info',
    title: 'Headshot needs approval',
    body: 'A doula updated a headshot. Review it before it is used.',
    ruleId: 'event_headshot',
  });
}
