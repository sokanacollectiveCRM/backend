import {
  VISIT_DEFAULT_TIME_ZONE,
  VISIT_MORNING_SEND_HOUR_LOCAL,
  VISIT_REMINDER_LEAD_HOURS,
} from './catalog';

export type VisitReminderRule = 'visit_reminder_24h' | 'visit_reminder_morning';
export type VisitRecipientRole = 'client' | 'doula';
export interface VisitReminderCandidate {
  bookingId: string;
  tenantId: string;
  clientId: string;
  doulaId: string;
  startAt: Date;
  createdAt: Date;
  status: string;
  postponed: boolean;
  timeZone: string;
  clientEmail: string | null;
  clientFirstName: string | null;
  doulaEmail: string | null;
  doulaFirstName: string | null;
}
export function visitTimeZone(value: string | null | undefined): string {
  try {
    if (value) {
      new Intl.DateTimeFormat('en-US', { timeZone: value });
      return value;
    }
  } catch {
    /* Invalid tenant setting falls back to Illinois. */
  }
  return VISIT_DEFAULT_TIME_ZONE;
}
function localParts(
  date: Date,
  timeZone: string
): { day: string; hour: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)!.value;
  return {
    day: `${get('year')}-${get('month')}-${get('day')}`,
    hour: Number(get('hour')),
  };
}
export function visitReminderRules(
  row: VisitReminderCandidate,
  now: Date,
  killed = false
): VisitReminderRule[] {
  if (
    killed ||
    row.status !== 'approved' ||
    row.postponed ||
    now >= row.startAt
  )
    return [];
  const rules: VisitReminderRule[] = [];
  const lead = row.startAt.getTime() - VISIT_REMINDER_LEAD_HOURS * 3600000;
  if (now.getTime() >= lead && row.createdAt.getTime() <= lead)
    rules.push('visit_reminder_24h');
  const tz = visitTimeZone(row.timeZone);
  const current = localParts(now, tz);
  const start = localParts(row.startAt, tz);
  if (
    current.day === start.day &&
    current.hour >= VISIT_MORNING_SEND_HOUR_LOCAL &&
    start.hour >= VISIT_MORNING_SEND_HOUR_LOCAL
  )
    rules.push('visit_reminder_morning');
  return rules;
}
export function visitReminderKey(
  row: VisitReminderCandidate,
  rule: VisitReminderRule,
  role: VisitRecipientRole
): string {
  return `${rule}:${row.bookingId}:${role}:${row.startAt.getTime()}`;
}
export function visitRelativeDay(
  row: VisitReminderCandidate,
  now: Date
): string {
  return localParts(now, visitTimeZone(row.timeZone)).day ===
    localParts(row.startAt, visitTimeZone(row.timeZone)).day
    ? 'today'
    : 'tomorrow';
}
