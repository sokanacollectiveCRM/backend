import type {
  AdminBookingRecord,
  AvailabilityRecord,
  BookingRecord,
  BookingStatus,
  TimeInterval,
} from '../domain/types';

export interface SchedulingConfig {
  requireContractStage(): boolean;
  frontendUrl(): string;
  visitDurationMinutes(): number;
}

export interface MailPort {
  sendEmail(
    to: string,
    subject: string,
    text: string,
    html?: string
  ): Promise<void>;
}

export interface RecipientLookup {
  email: string | null;
  clientNumber?: string | null;
  clientFirstName?: string | null;
  doulaName?: string | null;
}

export interface SchedulingStore {
  resolveClientId(input: {
    authUserId: string;
    email?: string | null;
  }): Promise<string | null>;

  assignmentIsActive(clientId: string, doulaId: string): Promise<boolean>;

  isClientInContractStage(clientId: string): Promise<boolean>;

  listAvailabilityIntervals(
    doulaId: string,
    status: 'available' | 'unavailable'
  ): Promise<TimeInterval[]>;

  listActiveBookingIntervals(
    doulaId: string,
    excludeBookingId?: string
  ): Promise<TimeInterval[]>;

  listAvailabilityByDoulaId(doulaId: string): Promise<AvailabilityRecord[]>;

  listClientBookings(clientId: string): Promise<BookingRecord[]>;

  listDoulaBookings(
    doulaId: string,
    range?: { from?: Date; to?: Date }
  ): Promise<BookingRecord[]>;

  listAdminBookings(filters: {
    doulaId?: string;
    clientId?: string;
    status?: BookingStatus;
    from?: Date;
    to?: Date;
  }): Promise<AdminBookingRecord[]>;

  getBookingById(bookingId: string): Promise<BookingRecord | null>;

  createBookingInTransaction(input: {
    clientId: string;
    doulaId: string;
    requestedBy: string | null;
    startAt: Date;
    endAt: Date;
    notes: string | null;
  }): Promise<BookingRecord>;

  updateBookingStatusInTransaction(input: {
    bookingId: string;
    nextStatus: BookingStatus;
    recheckOverlap: boolean;
  }): Promise<BookingRecord>;

  getDoulaRecipient(doulaId: string): Promise<RecipientLookup | null>;

  getClientRecipient(clientId: string): Promise<RecipientLookup | null>;
}
