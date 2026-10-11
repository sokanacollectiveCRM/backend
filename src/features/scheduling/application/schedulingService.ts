import {
  AuthorizationError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../../domains/errors';
import { normalizeNotes, parseBookingStatus } from '../domain/bookingRules';
import { assertBookingTransition } from '../domain/bookingRules';
import type { SchedulingActorRole } from '../domain/bookingRules';
import {
  assertVisitDuration,
  computeOpenSlots,
  parseDurationMinutes,
  parseIsoDateTime,
} from '../domain/slotMath';
import type {
  AdminBookingRecord,
  AvailabilityRecord,
  BookingRecord,
  BookingStatus,
  OpenSlot,
} from '../domain/types';
import {
  type BookingEmailKind,
  buildBookingNotificationEmail,
} from '../notifications/bookingNotificationEmail';
import type { MailPort, SchedulingConfig, SchedulingStore } from './ports';

export const CONTRACT_STAGE_MESSAGE =
  'Booking is only available once the client is in the contract stage';

export class SchedulingConflictError extends ConflictError {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.code = code;
    Object.setPrototypeOf(this, SchedulingConflictError.prototype);
  }
}

export interface SchedulingActor {
  id: string;
  role: SchedulingActorRole;
  email?: string | null;
}

export class SchedulingService {
  constructor(
    private readonly store: SchedulingStore,
    private readonly config: SchedulingConfig,
    private readonly mail: MailPort
  ) {}

  async listClientSlots(input: {
    actor: SchedulingActor;
    doulaId: string;
    from: unknown;
    to: unknown;
    durationMinutes?: unknown;
    now?: Date;
  }): Promise<{
    durationMinutes: number;
    from: string;
    to: string;
    slots: OpenSlot[];
  }> {
    this.assertRole(input.actor, ['client']);
    const doulaId = this.requireUuid(input.doulaId, 'doulaId');
    const clientId = await this.requireOwnClientId(input.actor);
    await this.assertActiveAssignment(clientId, doulaId);
    await this.assertContractStage(clientId);

    const from = parseIsoDateTime(input.from, 'from');
    const to = parseIsoDateTime(input.to, 'to');
    const durationMinutes = parseDurationMinutes(input.durationMinutes);
    const now = input.now ?? new Date();

    const [windows, blackouts, bookings] = await Promise.all([
      this.store.listAvailabilityIntervals(doulaId, 'available'),
      this.store.listAvailabilityIntervals(doulaId, 'unavailable'),
      this.store.listActiveBookingIntervals(doulaId),
    ]);

    const slots = computeOpenSlots({
      windows,
      blackouts,
      bookings,
      from,
      to,
      durationMinutes,
      now,
    });

    return {
      durationMinutes,
      from: from.toISOString(),
      to: to.toISOString(),
      slots,
    };
  }

  async createClientBooking(input: {
    actor: SchedulingActor;
    doulaId: unknown;
    startAt: unknown;
    endAt: unknown;
    notes?: unknown;
    clientId?: unknown;
  }): Promise<BookingRecord> {
    this.assertRole(input.actor, ['client', 'admin']);
    const doulaId = this.requireUuid(input.doulaId, 'doulaId');
    const clientId = await this.resolveBookingClientId(
      input.actor,
      input.clientId
    );
    await this.assertActiveAssignment(clientId, doulaId);
    await this.assertContractStage(clientId);

    const startAt = parseIsoDateTime(input.startAt, 'startAt');
    const endAt = parseIsoDateTime(input.endAt, 'endAt');
    assertVisitDuration(startAt, endAt, this.config.visitDurationMinutes());
    if (startAt <= new Date()) {
      throw new ValidationError('Visit start must be in the future');
    }

    const notes = normalizeNotes(input.notes);
    const booking = await this.store.createBookingInTransaction({
      clientId,
      doulaId,
      requestedBy: input.actor.id,
      startAt,
      endAt,
      notes,
    });

    void this.notifySafe({
      kind: 'request_created',
      booking,
      cancelledByClient: false,
    });
    return booking;
  }

  async listClientBookings(actor: SchedulingActor): Promise<BookingRecord[]> {
    this.assertRole(actor, ['client']);
    const clientId = await this.requireOwnClientId(actor);
    return this.store.listClientBookings(clientId);
  }

  async listDoulaBookings(input: {
    actor: SchedulingActor;
    from?: unknown;
    to?: unknown;
  }): Promise<BookingRecord[]> {
    this.assertRole(input.actor, ['doula']);
    return this.store.listDoulaBookings(input.actor.id, {
      from: input.from ? parseIsoDateTime(input.from, 'from') : undefined,
      to: input.to ? parseIsoDateTime(input.to, 'to') : undefined,
    });
  }

  async listAdminBookings(input: {
    actor: SchedulingActor;
    doulaId?: unknown;
    clientId?: unknown;
    status?: unknown;
    from?: unknown;
    to?: unknown;
  }): Promise<AdminBookingRecord[]> {
    this.assertRole(input.actor, ['admin']);
    return this.store.listAdminBookings({
      doulaId: input.doulaId
        ? this.requireUuid(input.doulaId, 'doulaId')
        : undefined,
      clientId: input.clientId
        ? this.requireUuid(input.clientId, 'clientId')
        : undefined,
      status: input.status ? parseBookingStatus(input.status) : undefined,
      from: input.from ? parseIsoDateTime(input.from, 'from') : undefined,
      to: input.to ? parseIsoDateTime(input.to, 'to') : undefined,
    });
  }

  async updateBookingStatus(input: {
    actor: SchedulingActor;
    bookingId: string;
    status: unknown;
  }): Promise<BookingRecord> {
    this.assertRole(input.actor, ['admin', 'doula', 'client']);
    const nextStatus = parseBookingStatus(input.status);
    const bookingId = this.requireUuid(input.bookingId, 'id');
    const existing = await this.store.getBookingById(bookingId);
    if (!existing) {
      throw new NotFoundError('Booking request not found');
    }

    if (input.actor.role === 'doula' && existing.doulaId !== input.actor.id) {
      throw new AuthorizationError('Forbidden: cannot update another doula visit');
    }
    if (input.actor.role === 'client') {
      const ownClientId = await this.requireOwnClientId(input.actor);
      if (existing.clientId !== ownClientId) {
        throw new AuthorizationError(
          'Forbidden: cannot update another client visit'
        );
      }
    }

    assertBookingTransition({
      currentStatus: existing.status,
      nextStatus,
      role: input.actor.role,
    });

    if (existing.status === nextStatus) {
      return existing;
    }

    const booking = await this.store.updateBookingStatusInTransaction({
      bookingId: existing.id,
      nextStatus,
      recheckOverlap: nextStatus === 'approved',
    });

    const cancelledByClient =
      nextStatus === 'cancelled' && input.actor.role === 'client';
    void this.notifySafe({
      kind: this.emailKindForStatus(nextStatus, cancelledByClient),
      booking,
      cancelledByClient,
    });
    return booking;
  }

  async listAdminAvailability(input: {
    actor: SchedulingActor;
    doulaId: string;
  }): Promise<AvailabilityRecord[]> {
    this.assertRole(input.actor, ['admin']);
    this.requireUuid(input.doulaId, 'doulaId');
    return this.store.listAvailabilityByDoulaId(input.doulaId);
  }

  private emailKindForStatus(
    status: BookingStatus,
    cancelledByClient: boolean
  ): BookingEmailKind {
    if (status === 'approved') return 'approved';
    if (status === 'rejected') return 'rejected';
    return cancelledByClient ? 'cancelled_client' : 'cancelled_other';
  }

  private async notifySafe(input: {
    kind: BookingEmailKind;
    booking: BookingRecord;
    cancelledByClient: boolean;
  }): Promise<void> {
    try {
      const startAt = new Date(input.booking.startAt);
      const frontendBaseUrl = this.config.frontendUrl();
      const [doula, client] = await Promise.all([
        this.store.getDoulaRecipient(input.booking.doulaId),
        this.store.getClientRecipient(input.booking.clientId),
      ]);

      const sends: Array<Promise<void>> = [];

      if (input.kind === 'request_created' && doula?.email) {
        const content = buildBookingNotificationEmail({
          kind: 'request_created',
          audience: 'doula',
          startAt,
          frontendBaseUrl,
          clientNumber: client?.clientNumber,
        });
        sends.push(
          this.mail.sendEmail(doula.email, content.subject, content.text, content.html)
        );
      }

      if (
        (input.kind === 'approved' ||
          input.kind === 'rejected' ||
          input.kind === 'cancelled_other' ||
          input.kind === 'cancelled_client') &&
        client?.email
      ) {
        const content = buildBookingNotificationEmail({
          kind: input.kind,
          audience: 'client',
          startAt,
          frontendBaseUrl,
        });
        sends.push(
          this.mail.sendEmail(
            client.email,
            content.subject,
            content.text,
            content.html
          )
        );
      }

      if (input.cancelledByClient && doula?.email) {
        const content = buildBookingNotificationEmail({
          kind: 'cancelled_client',
          audience: 'doula',
          startAt,
          frontendBaseUrl,
          clientNumber: client?.clientNumber,
        });
        sends.push(
          this.mail.sendEmail(doula.email, content.subject, content.text, content.html)
        );
      }

      await Promise.all(sends);
    } catch {
      // Best-effort: never fail the request. Caller already committed.
    }
  }

  private assertRole(
    actor: SchedulingActor,
    allowed: SchedulingActorRole[]
  ): void {
    if (!allowed.includes(actor.role)) {
      throw new AuthorizationError('Forbidden: Insufficient permissions');
    }
  }

  private requireUuid(value: unknown, fieldName: string): string {
    const text = String(value ?? '').trim();
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        text
      )
    ) {
      throw new ValidationError(`${fieldName} must be a UUID`);
    }
    return text;
  }

  private async requireOwnClientId(actor: SchedulingActor): Promise<string> {
    const clientId = await this.store.resolveClientId({
      authUserId: actor.id,
      email: actor.email,
    });
    if (!clientId) {
      throw new NotFoundError('Client profile not found');
    }
    return clientId;
  }

  private async resolveBookingClientId(
    actor: SchedulingActor,
    requestedClientId: unknown
  ): Promise<string> {
    if (actor.role === 'client') {
      const ownClientId = await this.requireOwnClientId(actor);
      if (requestedClientId) {
        const sent = String(requestedClientId);
        if (sent !== actor.id && sent !== ownClientId) {
          throw new AuthorizationError(
            'Forbidden: cannot create booking requests for another client'
          );
        }
      }
      return ownClientId;
    }

    if (!requestedClientId) {
      throw new ValidationError('clientId is required for admin booking');
    }
    return this.requireUuid(requestedClientId, 'clientId');
  }

  private async assertActiveAssignment(
    clientId: string,
    doulaId: string
  ): Promise<void> {
    const active = await this.store.assignmentIsActive(clientId, doulaId);
    if (!active) {
      throw new NotFoundError('Assigned doula not found for this client');
    }
  }

  private async assertContractStage(clientId: string): Promise<void> {
    if (!this.config.requireContractStage()) return;
    const inStage = await this.store.isClientInContractStage(clientId);
    if (!inStage) {
      const error = new AuthorizationError(CONTRACT_STAGE_MESSAGE);
      (error as AuthorizationError & { code?: string }).code =
        'CONTRACT_STAGE_REQUIRED';
      throw error;
    }
  }
}
