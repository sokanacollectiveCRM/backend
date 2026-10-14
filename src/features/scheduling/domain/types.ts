export const BOOKING_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'cancelled',
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const ACTIVE_BOOKING_STATUSES = ['pending', 'approved'] as const;

export const DEFAULT_VISIT_DURATION_MINUTES = 60;
export const MAX_SLOT_RANGE_DAYS = 14;
export const DISPLAY_TIME_ZONE = 'America/Chicago';

export interface TimeInterval {
  startAt: Date;
  endAt: Date;
}

export interface OpenSlot {
  startAt: string;
  endAt: string;
}

export interface BookingRecord {
  id: string;
  clientId: string;
  doulaId: string;
  startAt: string;
  endAt: string;
  status: BookingStatus;
  notes: string | null;
  requestedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminBookingRecord extends BookingRecord {
  doulaName: string | null;
  clientNumber: string | null;
  clientFirstName: string | null;
}

export interface AvailabilityRecord {
  id: string;
  doulaId: string;
  startAt: string;
  endAt: string;
  availabilityStatus: 'available' | 'unavailable';
  reason: string | null;
  createdAt: string;
  updatedAt: string;
}

export function isBookingStatus(value: unknown): value is BookingStatus {
  return (
    typeof value === 'string' &&
    (BOOKING_STATUSES as readonly string[]).includes(value)
  );
}
