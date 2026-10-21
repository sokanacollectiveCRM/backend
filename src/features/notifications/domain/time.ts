import {
  BIRTH_OUTCOME_GRACE_DAYS,
  BIRTH_OUTCOME_REPEAT_HOURS,
  NOTE_OVERDUE_DAYS,
  POSTPONEMENT_DEFAULT_DAYS,
  SIGNING_WINDOW_DAYS,
} from './catalog';

const DAY_MS = 24 * 60 * 60 * 1000;
const NEW_YORK = 'America/New_York';

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function wholeDaysBetween(start: Date, end: Date): number {
  return Math.floor((end.getTime() - start.getTime()) / DAY_MS);
}

export function signingCancelDate(windowStartedAt: Date): Date {
  return addDays(windowStartedAt, SIGNING_WINDOW_DAYS);
}

export function defaultPostponementRestart(now: Date): string {
  return formatNewYorkDate(addDays(now, POSTPONEMENT_DEFAULT_DAYS));
}

export function formatNewYorkDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: NEW_YORK,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function formatLongNewYorkDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: NEW_YORK,
    dateStyle: 'long',
  }).format(date);
}

export function birthOutcomeStart(input: {
  dueDate: Date | null;
  babyDeliveredAt: Date | null;
}): Date | null {
  if (input.babyDeliveredAt) return input.babyDeliveredAt;
  if (!input.dueDate) return null;
  return addDays(input.dueDate, BIRTH_OUTCOME_GRACE_DAYS);
}

export function birthOutcomeSlot(start: Date, now: Date): number | null {
  const elapsed = now.getTime() - start.getTime();
  if (elapsed < 0) return null;
  return Math.floor(elapsed / (BIRTH_OUTCOME_REPEAT_HOURS * 60 * 60 * 1000));
}

export function noteIsOverdue(lastActivityAt: Date, now: Date): boolean {
  return wholeDaysBetween(lastActivityAt, now) >= NOTE_OVERDUE_DAYS;
}

export function newYorkToday(now: Date): string {
  return formatNewYorkDate(now);
}
