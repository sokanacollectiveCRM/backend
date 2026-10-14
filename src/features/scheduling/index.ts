/**
 * Public scheduling feature API.
 * Cross-feature consumers should import from this barrel only.
 */

export {
  DEFAULT_VISIT_DURATION_MINUTES,
  MAX_SLOT_RANGE_DAYS,
  DISPLAY_TIME_ZONE,
  BOOKING_STATUSES,
} from './domain/types';
export type {
  BookingRecord,
  AdminBookingRecord,
  AvailabilityRecord,
  BookingStatus,
  OpenSlot,
} from './domain/types';

export { computeOpenSlots, parseIsoDateTime } from './domain/slotMath';
export { bookingRequiresContractStage } from './application/config';
export { SchedulingService } from './application/schedulingService';
export { createSchedulingService } from './composition';
