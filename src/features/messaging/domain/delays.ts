import { DelayUnit } from './types';

export function addDelay(from: Date, value: number, unit: DelayUnit): Date {
  const next = new Date(from.getTime());
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount === 0) {
    return next;
  }
  switch (unit) {
    case 'minutes':
      next.setUTCMinutes(next.getUTCMinutes() + amount);
      return next;
    case 'hours':
      next.setUTCHours(next.getUTCHours() + amount);
      return next;
    case 'days':
      next.setUTCDate(next.getUTCDate() + amount);
      return next;
    case 'business_days': {
      const step = amount > 0 ? 1 : -1;
      let added = 0;
      const target = Math.abs(amount);
      while (added < target) {
        next.setUTCDate(next.getUTCDate() + step);
        const day = next.getUTCDay();
        if (day !== 0 && day !== 6) added += 1;
      }
      return next;
    }
    default:
      return next;
  }
}

export function formatDateUtc(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function windowStartKey(dueAt: Date): string {
  return dueAt.toISOString().slice(0, 16);
}
