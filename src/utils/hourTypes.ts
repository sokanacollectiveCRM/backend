import { z } from 'zod';

export const HOUR_TYPES = ['prenatal', 'postpartum'] as const;
export type HourType = (typeof HOUR_TYPES)[number];

export const HOUR_FILTER_TYPES = [...HOUR_TYPES, 'unknown'] as const;
export type HourFilterType = (typeof HOUR_FILTER_TYPES)[number];

const hourTypeSchema = z.enum(HOUR_TYPES);
const hourFilterSchema = z.enum(HOUR_FILTER_TYPES);

export interface HourEntryLike {
  type?: string | null;
  start_time?: string | Date | null;
  end_time?: string | Date | null;
  startTime?: string | Date | null;
  endTime?: string | Date | null;
}

export interface HourSummary {
  total_hours: number;
  prenatal_hours: number;
  postpartum_hours: number;
  unknown_hours: number;
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

export function parseHourType(value: unknown): HourType | null {
  const parsed = hourTypeSchema.safeParse(String(value ?? '').toLowerCase());
  return parsed.success ? parsed.data : null;
}

export function parseHourFilter(value: unknown): HourFilterType | null {
  if (value === undefined || value === null || String(value).trim() === '') {
    return null;
  }

  const parsed = hourFilterSchema.safeParse(String(value).toLowerCase());
  return parsed.success ? parsed.data : null;
}

export function getHourDurationHours(entry: HourEntryLike): number {
  const start = toDate(entry.start_time ?? entry.startTime);
  const end = toDate(entry.end_time ?? entry.endTime);

  if (!start || !end) {
    return 0;
  }

  const diffMs = end.getTime() - start.getTime();
  if (!Number.isFinite(diffMs) || diffMs <= 0) {
    return 0;
  }

  return roundToTwoDecimals(diffMs / (1000 * 60 * 60));
}

export function buildHourSummary(entries: HourEntryLike[]): HourSummary {
  const summary: HourSummary = {
    total_hours: 0,
    prenatal_hours: 0,
    postpartum_hours: 0,
    unknown_hours: 0,
  };

  for (const entry of entries) {
    const duration = getHourDurationHours(entry);
    summary.total_hours = roundToTwoDecimals(summary.total_hours + duration);

    const normalizedType = parseHourType(entry.type);
    if (normalizedType === 'prenatal') {
      summary.prenatal_hours = roundToTwoDecimals(summary.prenatal_hours + duration);
    } else if (normalizedType === 'postpartum') {
      summary.postpartum_hours = roundToTwoDecimals(summary.postpartum_hours + duration);
    } else {
      summary.unknown_hours = roundToTwoDecimals(summary.unknown_hours + duration);
    }
  }

  return summary;
}
