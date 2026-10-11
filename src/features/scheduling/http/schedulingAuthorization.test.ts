import express from 'express';
import request from 'supertest';

import type { SchedulingService } from '../application/schedulingService';
import { SchedulingController } from './schedulingController';
import { buildSchedulingRouter } from './schedulingRoutes';

let currentUser: { id: string; role: string; email: string } | null = null;

jest.mock('../composition', () => ({
  createSchedulingController: () => ({
    listClientSlots: jest.fn(),
    createClientBooking: jest.fn(),
    listClientBookings: jest.fn(),
    listDoulaBookings: jest.fn(),
    listAdminBookings: jest.fn(),
    updateBooking: jest.fn(),
    listAdminAvailability: jest.fn(),
  }),
}));

jest.mock('../../../middleware/authMiddleware', () => ({
  __esModule: true,
  default: (req: any, res: any, next: any) => {
    if (!currentUser) {
      res.status(401).json({ error: 'No session token provided' });
      return;
    }
    req.user = currentUser;
    next();
  },
}));

const DOULA_ID = '11111111-1111-4111-8111-111111111111';
const CLIENT_ID = '22222222-2222-4222-8222-222222222222';
const BOOKING_ID = '44444444-4444-4444-8444-444444444444';

function mockService(): jest.Mocked<SchedulingService> {
  return {
    listClientSlots: jest.fn().mockResolvedValue({
      durationMinutes: 60,
      from: '2026-10-13T00:00:00.000Z',
      to: '2026-10-20T00:00:00.000Z',
      slots: [],
    }),
    createClientBooking: jest.fn().mockResolvedValue({
      id: BOOKING_ID,
      clientId: CLIENT_ID,
      doulaId: DOULA_ID,
      status: 'pending',
    }),
    listClientBookings: jest.fn().mockResolvedValue([]),
    listDoulaBookings: jest.fn().mockResolvedValue([]),
    listAdminBookings: jest.fn().mockResolvedValue([]),
    updateBookingStatus: jest.fn().mockResolvedValue({ id: BOOKING_ID }),
    listAdminAvailability: jest.fn().mockResolvedValue([]),
  } as unknown as jest.Mocked<SchedulingService>;
}

function buildApp(service: jest.Mocked<SchedulingService>) {
  const app = express();
  app.use(express.json());
  app.use(
    '/api/scheduling',
    buildSchedulingRouter(new SchedulingController(service))
  );
  return app;
}

describe('scheduling authorization matrix', () => {
  const client = {
    id: CLIENT_ID,
    role: 'client',
    email: 'jerry+sokanaclient@techluminateacademy.com',
  };
  const doula = {
    id: DOULA_ID,
    role: 'doula',
    email: 'jerry+sokanadoula@techluminateacademy.com',
  };
  const admin = {
    id: '55555555-5555-4555-8555-555555555555',
    role: 'admin',
    email: 'jerry+sokanaadmin@techluminateacademy.com',
  };

  beforeEach(() => {
    currentUser = null;
  });

  it('rejects anonymous callers on every scheduling route', async () => {
    const app = buildApp(mockService());
    const paths: Array<[string, string]> = [
      [
        'get',
        `/api/scheduling/client/doulas/${DOULA_ID}/slots?from=2026-10-13T00:00:00.000Z&to=2026-10-20T00:00:00.000Z`,
      ],
      ['post', '/api/scheduling/client/bookings'],
      ['get', '/api/scheduling/client/bookings'],
      ['get', '/api/scheduling/doula/bookings'],
      ['get', '/api/scheduling/admin/bookings'],
      ['patch', `/api/scheduling/bookings/${BOOKING_ID}`],
      ['get', `/api/scheduling/admin/doulas/${DOULA_ID}/availability`],
    ];
    for (const [method, path] of paths) {
      const res = await (request(app) as any)[method](path).send({});
      expect(res.status).toBe(401);
    }
  });

  it('keeps slots and client booking list client-only', async () => {
    const app = buildApp(mockService());
    currentUser = doula;
    expect(
      (
        await request(app).get(
          `/api/scheduling/client/doulas/${DOULA_ID}/slots?from=2026-10-13T00:00:00.000Z&to=2026-10-20T00:00:00.000Z`
        )
      ).status
    ).toBe(403);
    expect((await request(app).get('/api/scheduling/client/bookings')).status).toBe(
      403
    );

    currentUser = client;
    expect(
      (
        await request(app).get(
          `/api/scheduling/client/doulas/${DOULA_ID}/slots?from=2026-10-13T00:00:00.000Z&to=2026-10-20T00:00:00.000Z`
        )
      ).status
    ).toBe(200);
    expect((await request(app).get('/api/scheduling/client/bookings')).status).toBe(
      200
    );
  });

  it('keeps doula booking list doula-only', async () => {
    const app = buildApp(mockService());
    currentUser = client;
    expect((await request(app).get('/api/scheduling/doula/bookings')).status).toBe(
      403
    );
    currentUser = doula;
    expect((await request(app).get('/api/scheduling/doula/bookings')).status).toBe(
      200
    );
  });

  it('keeps admin list/availability admin-only', async () => {
    const app = buildApp(mockService());
    currentUser = client;
    expect((await request(app).get('/api/scheduling/admin/bookings')).status).toBe(
      403
    );
    expect(
      (
        await request(app).get(
          `/api/scheduling/admin/doulas/${DOULA_ID}/availability`
        )
      ).status
    ).toBe(403);
    currentUser = admin;
    expect((await request(app).get('/api/scheduling/admin/bookings')).status).toBe(
      200
    );
    expect(
      (
        await request(app).get(
          `/api/scheduling/admin/doulas/${DOULA_ID}/availability`
        )
      ).status
    ).toBe(200);
  });

  it('allows client and admin to create bookings, not a doula', async () => {
    const app = buildApp(mockService());
    const body = {
      doulaId: DOULA_ID,
      startAt: '2026-10-20T15:00:00.000Z',
      endAt: '2026-10-20T16:00:00.000Z',
    };
    currentUser = doula;
    expect(
      (await request(app).post('/api/scheduling/client/bookings').send(body))
        .status
    ).toBe(403);
    currentUser = client;
    expect(
      (await request(app).post('/api/scheduling/client/bookings').send(body))
        .status
    ).toBe(201);
    currentUser = admin;
    expect(
      (
        await request(app)
          .post('/api/scheduling/client/bookings')
          .send({ ...body, clientId: CLIENT_ID })
      ).status
    ).toBe(201);
  });

  it('allows client, doula, and admin onto PATCH /bookings/:id', async () => {
    const app = buildApp(mockService());
    for (const user of [client, doula, admin]) {
      currentUser = user;
      const res = await request(app)
        .patch(`/api/scheduling/bookings/${BOOKING_ID}`)
        .send({ status: 'cancelled' });
      expect(res.status).toBe(200);
    }
  });
});
