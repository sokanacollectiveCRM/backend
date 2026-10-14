import {
  AuthorizationError,
  NotFoundError,
  ValidationError,
} from '../../../domains/errors';
import type {
  AdminBookingRecord,
  AvailabilityRecord,
  BookingRecord,
  BookingStatus,
  TimeInterval,
} from '../domain/types';
import type { MailPort, SchedulingConfig, SchedulingStore } from './ports';
import {
  CONTRACT_STAGE_MESSAGE,
  SchedulingConflictError,
  SchedulingService,
} from './schedulingService';

const DOULA_ID = '11111111-1111-4111-8111-111111111111';
const CLIENT_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_CLIENT = '33333333-3333-4333-8333-333333333333';
const BOOKING_ID = '44444444-4444-4444-8444-444444444444';

const startAt = '2026-10-20T15:00:00.000Z';
const endAt = '2026-10-20T16:00:00.000Z';

function booking(overrides: Partial<BookingRecord> = {}): BookingRecord {
  return {
    id: BOOKING_ID,
    clientId: CLIENT_ID,
    doulaId: DOULA_ID,
    startAt,
    endAt,
    status: 'pending',
    notes: 'secret note about health',
    requestedBy: CLIENT_ID,
    createdAt: '2026-10-11T00:00:00.000Z',
    updatedAt: '2026-10-11T00:00:00.000Z',
    ...overrides,
  };
}

function createStore(
  overrides: Partial<SchedulingStore> = {}
): SchedulingStore {
  return {
    resolveClientId: jest.fn().mockResolvedValue(CLIENT_ID),
    assignmentIsActive: jest.fn().mockResolvedValue(true),
    isClientInContractStage: jest.fn().mockResolvedValue(true),
    listAvailabilityIntervals: jest.fn().mockResolvedValue([]),
    listActiveBookingIntervals: jest.fn().mockResolvedValue([]),
    listAvailabilityByDoulaId: jest.fn().mockResolvedValue([]),
    listClientBookings: jest.fn().mockResolvedValue([]),
    listDoulaBookings: jest.fn().mockResolvedValue([]),
    listAdminBookings: jest.fn().mockResolvedValue([]),
    getBookingById: jest.fn().mockResolvedValue(booking()),
    createBookingInTransaction: jest.fn().mockResolvedValue(booking()),
    updateBookingStatusInTransaction: jest
      .fn()
      .mockResolvedValue(booking({ status: 'approved' })),
    getDoulaRecipient: jest.fn().mockResolvedValue({
      email: 'jerry+sokanadoula@techluminateacademy.com',
    }),
    getClientRecipient: jest.fn().mockResolvedValue({
      email: 'jerry+sokanaclient@techluminateacademy.com',
      clientNumber: 'CL-PILOT-001',
    }),
    ...overrides,
  };
}

const config: SchedulingConfig = {
  requireContractStage: () => true,
  frontendUrl: () => 'https://crm.example.com',
  visitDurationMinutes: () => 60,
};

function mailSpy(): MailPort & { sendEmail: jest.Mock } {
  return { sendEmail: jest.fn().mockResolvedValue(undefined) };
}

describe('SchedulingService', () => {
  const clientActor = {
    id: CLIENT_ID,
    role: 'client' as const,
    email: 'jerry+sokanaclient@techluminateacademy.com',
  };
  const doulaActor = {
    id: DOULA_ID,
    role: 'doula' as const,
    email: 'jerry+sokanadoula@techluminateacademy.com',
  };
  const adminActor = {
    id: '55555555-5555-4555-8555-555555555555',
    role: 'admin' as const,
    email: 'jerry+sokanaadmin@techluminateacademy.com',
  };

  it('rejects slots when the assignment is not active', async () => {
    const store = createStore({
      assignmentIsActive: jest.fn().mockResolvedValue(false),
    });
    const service = new SchedulingService(store, config, mailSpy());
    await expect(
      service.listClientSlots({
        actor: clientActor,
        doulaId: DOULA_ID,
        from: '2026-10-13T00:00:00.000Z',
        to: '2026-10-20T00:00:00.000Z',
        now: new Date('2026-10-12T00:00:00.000Z'),
      })
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('rejects slots and bookings before contract stage when the flag is on', async () => {
    const store = createStore({
      isClientInContractStage: jest.fn().mockResolvedValue(false),
    });
    const service = new SchedulingService(store, config, mailSpy());
    await expect(
      service.listClientSlots({
        actor: clientActor,
        doulaId: DOULA_ID,
        from: '2026-10-13T00:00:00.000Z',
        to: '2026-10-20T00:00:00.000Z',
      })
    ).rejects.toMatchObject({
      message: CONTRACT_STAGE_MESSAGE,
    });
    await expect(
      service.createClientBooking({
        actor: clientActor,
        doulaId: DOULA_ID,
        startAt,
        endAt,
      })
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it('skips the contract-stage gate when the env flag is false', async () => {
    const store = createStore({
      isClientInContractStage: jest.fn().mockResolvedValue(false),
      listAvailabilityIntervals: jest.fn().mockImplementation(
        async (_id: string, status: string): Promise<TimeInterval[]> =>
          status === 'available'
            ? [
                {
                  startAt: new Date('2026-10-20T15:00:00.000Z'),
                  endAt: new Date('2026-10-20T17:00:00.000Z'),
                },
              ]
            : []
      ),
    });
    const off: SchedulingConfig = {
      ...config,
      requireContractStage: () => false,
    };
    const service = new SchedulingService(store, off, mailSpy());
    const result = await service.listClientSlots({
      actor: clientActor,
      doulaId: DOULA_ID,
      from: '2026-10-20T00:00:00.000Z',
      to: '2026-10-27T00:00:00.000Z',
      now: new Date('2026-10-19T00:00:00.000Z'),
    });
    expect(result.slots).toHaveLength(2);
  });

  it("stops a client from booking another client's doula", async () => {
    const store = createStore({
      resolveClientId: jest.fn().mockResolvedValue(CLIENT_ID),
    });
    const service = new SchedulingService(store, config, mailSpy());
    await expect(
      service.createClientBooking({
        actor: clientActor,
        doulaId: DOULA_ID,
        clientId: OTHER_CLIENT,
        startAt,
        endAt,
      })
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it('maps window / blackout / overlap failures to 409 conflict codes', async () => {
    const store = createStore({
      createBookingInTransaction: jest
        .fn()
        .mockRejectedValueOnce(
          new SchedulingConflictError(
            'Requested time is not inside an available window',
            'BOOKING_OUTSIDE_WINDOW'
          )
        )
        .mockRejectedValueOnce(
          new SchedulingConflictError(
            'Doula is unavailable',
            'BOOKING_BLACKOUT'
          )
        )
        .mockRejectedValueOnce(
          new SchedulingConflictError('overlap', 'BOOKING_OVERLAP')
        ),
    });
    const service = new SchedulingService(store, config, mailSpy());
    const payload = {
      actor: clientActor,
      doulaId: DOULA_ID,
      startAt,
      endAt,
    };
    await expect(service.createClientBooking(payload)).rejects.toMatchObject({
      code: 'BOOKING_OUTSIDE_WINDOW',
    });
    await expect(service.createClientBooking(payload)).rejects.toMatchObject({
      code: 'BOOKING_BLACKOUT',
    });
    await expect(service.createClientBooking(payload)).rejects.toMatchObject({
      code: 'BOOKING_OVERLAP',
    });
  });

  it('requires a 60-minute future visit', async () => {
    const service = new SchedulingService(createStore(), config, mailSpy());
    await expect(
      service.createClientBooking({
        actor: clientActor,
        doulaId: DOULA_ID,
        startAt,
        endAt: '2026-10-20T15:30:00.000Z',
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('lets an admin pass clientId and a doula only see own bookings', async () => {
    const store = createStore();
    const service = new SchedulingService(store, config, mailSpy());
    await service.createClientBooking({
      actor: adminActor,
      doulaId: DOULA_ID,
      clientId: CLIENT_ID,
      startAt,
      endAt,
    });
    expect(store.createBookingInTransaction).toHaveBeenCalled();

    const listed = await service.listDoulaBookings({ actor: doulaActor });
    expect(store.listDoulaBookings).toHaveBeenCalledWith(
      DOULA_ID,
      expect.any(Object)
    );
    expect(listed).toEqual([]);
  });

  it("blocks a doula from approving another doula's booking", async () => {
    const store = createStore({
      getBookingById: jest
        .fn()
        .mockResolvedValue(booking({ doulaId: OTHER_CLIENT })),
    });
    const service = new SchedulingService(store, config, mailSpy());
    await expect(
      service.updateBookingStatus({
        actor: doulaActor,
        bookingId: BOOKING_ID,
        status: 'approved',
      })
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it('re-checks overlap on approve and notifies without sending notes', async () => {
    const mail = mailSpy();
    const store = createStore();
    const service = new SchedulingService(store, config, mail);
    await service.updateBookingStatus({
      actor: doulaActor,
      bookingId: BOOKING_ID,
      status: 'approved',
    });
    expect(store.updateBookingStatusInTransaction).toHaveBeenCalledWith({
      bookingId: BOOKING_ID,
      nextStatus: 'approved',
      recheckOverlap: true,
    });
    await new Promise((resolve) => setImmediate(resolve));
    expect(mail.sendEmail).toHaveBeenCalled();
    const [, subject, text] = mail.sendEmail.mock.calls[0];
    expect(subject).toBe('Visit request approved');
    expect(text).not.toContain('secret note');
  });

  it('returns admin bookings with name/number only and admin availability', async () => {
    const adminBooking: AdminBookingRecord = {
      ...booking(),
      doulaName: 'Maya Rivers',
      clientNumber: 'CL-PILOT-001',
      clientFirstName: 'Jordan',
    };
    const records: AvailabilityRecord[] = [];
    const store = createStore({
      listAdminBookings: jest.fn().mockResolvedValue([adminBooking]),
      listAvailabilityByDoulaId: jest.fn().mockResolvedValue(records),
    });
    const service = new SchedulingService(store, config, mailSpy());
    await expect(
      service.listAdminBookings({ actor: clientActor })
    ).rejects.toBeInstanceOf(AuthorizationError);
    const bookings = await service.listAdminBookings({
      actor: adminActor,
      status: 'pending',
    });
    expect(bookings[0].clientFirstName).toBe('Jordan');
    expect(bookings[0].clientNumber).toBe('CL-PILOT-001');
    await service.listAdminAvailability({
      actor: adminActor,
      doulaId: DOULA_ID,
    });
    expect(store.listAvailabilityByDoulaId).toHaveBeenCalledWith(DOULA_ID);
  });

  it('lets a client cancel their own visit', async () => {
    const store = createStore();
    const service = new SchedulingService(store, config, mailSpy());
    await service.updateBookingStatus({
      actor: clientActor,
      bookingId: BOOKING_ID,
      status: 'cancelled',
    });
    expect(store.updateBookingStatusInTransaction).toHaveBeenCalledWith({
      bookingId: BOOKING_ID,
      nextStatus: 'cancelled',
      recheckOverlap: false,
    });
  });
});

export type { BookingStatus };
