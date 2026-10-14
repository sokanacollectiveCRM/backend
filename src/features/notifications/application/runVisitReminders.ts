import { isRuleEnabled } from '../domain/catalog';
import { visitReminderKey, visitReminderRules } from '../domain/visitReminders';
import type { VisitRecipientRole } from '../domain/visitReminders';
import { NotificationEmail } from '../infrastructure/notificationEmail';
import { NotificationStore } from '../infrastructure/notificationStore';

export async function runVisitReminders(
  now: Date,
  store: NotificationStore,
  email: NotificationEmail,
  scope?: { bookingId: string; tenantId: string }
): Promise<{ sent: number; skipped: number; failed: number }> {
  const result = { sent: 0, skipped: 0, failed: 0 };
  if (await store.isKilled()) return result;
  for (const row of await store.listVisitCandidates(
    now,
    scope?.bookingId,
    scope?.tenantId
  )) {
    for (const rule of visitReminderRules(row, now)) {
      if (!isRuleEnabled(rule)) continue;
      for (const role of ['client', 'doula'] as VisitRecipientRole[]) {
        const dedupeKey = visitReminderKey(row, rule, role);
        if (
          !(await store.claimVisit({
            dedupeKey,
            ruleId: rule,
            role,
            bookingId: row.bookingId,
            tenantId: row.tenantId,
          }))
        )
          continue;
        try {
          const [fresh] = await store.listVisitCandidates(
            now,
            row.bookingId,
            row.tenantId
          );
          const killed = await store.isKilled();
          if (
            !fresh ||
            fresh.startAt.getTime() !== row.startAt.getTime() ||
            !visitReminderRules(fresh, now, killed).includes(rule)
          ) {
            // No send attempted: allow retry if temporary stop conditions lift.
            await store.releaseClaim(dedupeKey);
            result.skipped++;
            continue;
          }
          if (!(role === 'client' ? fresh.clientEmail : fresh.doulaEmail)) {
            await store.markDelivery(dedupeKey, 'skipped');
            result.skipped++;
            continue;
          }
          await email.sendVisitReminder(fresh, role, now);
          await store.markDelivery(dedupeKey, 'sent');
          result.sent++;
        } catch {
          await store.markDelivery(dedupeKey, 'failed');
          result.failed++;
        }
      }
    }
  }
  return result;
}
