import { DelayUnit } from './types';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export function durationMs(value: number, unit: DelayUnit): number {
  switch (unit) {
    case 'minutes':
      return value * MINUTE_MS;
    case 'hours':
      return value * HOUR_MS;
    case 'days':
    case 'business_days':
      return value * DAY_MS;
    default:
      return value * DAY_MS;
  }
}

export function addDelay(from: Date, value: number, unit: DelayUnit): Date {
  if (unit === 'business_days') {
    const result = new Date(from.getTime());
    let remaining = value;
    while (remaining > 0) {
      result.setUTCDate(result.getUTCDate() + 1);
      const day = result.getUTCDay();
      if (day !== 0 && day !== 6) {
        remaining -= 1;
      }
    }
    return result;
  }
  return new Date(from.getTime() + durationMs(value, unit));
}

export function formatMergeDate(
  value: Date | string | null | undefined
): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

export function windowStartIso(
  firstDueAt: Date,
  now: Date,
  repeatEveryValue: number | null,
  repeatEveryUnit: DelayUnit | null
): string {
  if (!repeatEveryValue || !repeatEveryUnit) {
    return firstDueAt.toISOString();
  }
  const interval = durationMs(repeatEveryValue, repeatEveryUnit);
  if (interval <= 0 || now.getTime() <= firstDueAt.getTime()) {
    return firstDueAt.toISOString();
  }
  const elapsed = now.getTime() - firstDueAt.getTime();
  const n = Math.floor(elapsed / interval);
  return new Date(firstDueAt.getTime() + n * interval).toISOString();
}
