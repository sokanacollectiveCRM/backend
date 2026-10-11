import { ValidationError } from '../../../domains/errors';
import {
  DEFAULT_VISIT_DURATION_MINUTES,
  MAX_SLOT_RANGE_DAYS,
  type OpenSlot,
  type TimeInterval,
} from './types';

export function parseIsoDateTime(value: unknown, fieldName: string): Date {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ValidationError(
      `${fieldName} is required and must be an ISO datetime string`
    );
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError(`${fieldName} must be a valid ISO datetime string`);
  }
  return date;
}

export function validateRange(startAt: Date, endAt: Date): void {
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    throw new ValidationError('startAt and endAt must be valid ISO datetime strings');
  }
  if (!(startAt < endAt)) {
    throw new ValidationError('startAt must be earlier than endAt');
  }
}

export function assertSlotQueryRange(from: Date, to: Date): void {
  if (!(from < to)) {
    throw new ValidationError('from must be earlier than to');
  }
  const maxMs = MAX_SLOT_RANGE_DAYS * 24 * 60 * 60 * 1000;
  if (to.getTime() - from.getTime() > maxMs) {
    throw new ValidationError(
      `Slot range cannot exceed ${MAX_SLOT_RANGE_DAYS} days`
    );
  }
}

export function assertVisitDuration(
  startAt: Date,
  endAt: Date,
  durationMinutes: number = DEFAULT_VISIT_DURATION_MINUTES
): void {
  validateRange(startAt, endAt);
  const actualMs = endAt.getTime() - startAt.getTime();
  const expectedMs = durationMinutes * 60 * 1000;
  if (actualMs !== expectedMs) {
    throw new ValidationError(
      `Visit duration must be exactly ${durationMinutes} minutes`
    );
  }
}

export function parseDurationMinutes(value: unknown): number {
  if (value === undefined || value === null || value === '') {
    return DEFAULT_VISIT_DURATION_MINUTES;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed !== DEFAULT_VISIT_DURATION_MINUTES) {
    throw new ValidationError(
      `durationMinutes must be ${DEFAULT_VISIT_DURATION_MINUTES}`
    );
  }
  return parsed;
}

export function intervalsOverlap(a: TimeInterval, b: TimeInterval): boolean {
  return a.startAt < b.endAt && a.endAt > b.startAt;
}

export function isFullyInside(inner: TimeInterval, outer: TimeInterval): boolean {
  return inner.startAt >= outer.startAt && inner.endAt <= outer.endAt;
}

export function isFullyInsideAnyWindow(
  slot: TimeInterval,
  windows: TimeInterval[]
): boolean {
  return windows.some((window) => isFullyInside(slot, window));
}

/**
 * Open slots = available windows minus blackouts minus pending/approved
 * bookings, cut into fixed-length slots aligned to each window start.
 * Past slots are dropped. The entire slot must lie inside [from, to].
 */
export function computeOpenSlots(input: {
  windows: TimeInterval[];
  blackouts: TimeInterval[];
  bookings: TimeInterval[];
  from: Date;
  to: Date;
  durationMinutes: number;
  now: Date;
}): OpenSlot[] {
  assertSlotQueryRange(input.from, input.to);
  if (
    !Number.isInteger(input.durationMinutes) ||
    input.durationMinutes !== DEFAULT_VISIT_DURATION_MINUTES
  ) {
    throw new ValidationError(
      `durationMinutes must be ${DEFAULT_VISIT_DURATION_MINUTES}`
    );
  }

  const durationMs = input.durationMinutes * 60 * 1000;
  const blockers = [...input.blackouts, ...input.bookings];
  const slots: OpenSlot[] = [];

  for (const window of input.windows) {
    if (!(window.startAt < window.endAt)) continue;
    let cursor = window.startAt.getTime();
    const windowEnd = window.endAt.getTime();

    while (cursor + durationMs <= windowEnd) {
      const startAt = new Date(cursor);
      const endAt = new Date(cursor + durationMs);
      cursor += durationMs;

      const slot: TimeInterval = { startAt, endAt };
      if (startAt < input.now) continue;
      if (startAt < input.from || endAt > input.to) continue;
      if (blockers.some((blocker) => intervalsOverlap(slot, blocker))) continue;
      slots.push({
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
      });
    }
  }

  slots.sort((a, b) => a.startAt.localeCompare(b.startAt));
  return slots;
}
