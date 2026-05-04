import express from 'express';
import request from 'supertest';
import { DoulaController } from '../controllers/doulaController';
import { UserController } from '../controllers/userController';
import { UserUseCase } from '../usecase/userUseCase';
import type { AuthRequest } from '../types';

describe('Hour endpoints', () => {
  const doulaId = 'doula-123';
  const clientId = 'client-123';
  const hourId = 'hour-123';

  function buildDoulaController(overrides?: {
    userUseCase?: Partial<UserUseCase>;
    clientUseCase?: { getClientsLite: jest.Mock };
  }) {
    const userUseCase = overrides?.userUseCase ?? ({
      addNewHours: jest.fn(),
      getHoursById: jest.fn(),
      updateHourType: jest.fn(),
    } as unknown as UserUseCase);
    const clientUseCase = overrides?.clientUseCase ?? {
      getClientsLite: jest.fn().mockResolvedValue([{ id: clientId }]),
    };

    return {
      controller: new DoulaController(
        {} as any,
        {} as any,
        {} as any,
        {
          getActivitiesByClientId: jest.fn(),
        } as any,
        {} as any,
        userUseCase as any,
        clientUseCase as any
      ),
      userUseCase,
      clientUseCase,
    };
  }

  function buildUserController(userUseCase: Partial<UserUseCase>) {
    return new UserController(userUseCase as any);
  }

  function buildApp(role: 'admin' | 'doula' = 'doula') {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as AuthRequest).user = {
        id: doulaId,
        email: 'doula@example.com',
        role,
      } as any;
      next();
    });
    return app;
  }

  it('creates a prenatal entry', async () => {
    const { controller, userUseCase } = buildDoulaController();
    (userUseCase.addNewHours as jest.Mock).mockResolvedValue({
      id: hourId,
      doula_id: doulaId,
      client_id: clientId,
      start_time: '2026-04-23T10:00:00.000Z',
      end_time: '2026-04-23T11:00:00.000Z',
      type: 'prenatal',
    });

    const app = buildApp();
    app.post('/api/doulas/hours', (req, res) => controller.logHours(req as AuthRequest, res));

    const res = await request(app)
      .post('/api/doulas/hours')
      .send({
        client_id: clientId,
        start_time: '2026-04-23T10:00:00.000Z',
        end_time: '2026-04-23T11:00:00.000Z',
        type: 'prenatal',
      });

    expect(res.status).toBe(201);
    expect(userUseCase.addNewHours).toHaveBeenCalledWith(
      doulaId,
      clientId,
      new Date('2026-04-23T10:00:00.000Z'),
      new Date('2026-04-23T11:00:00.000Z'),
      '',
      'prenatal'
    );
    expect(res.body.workEntry.type).toBe('prenatal');
  });

  it('creates a postpartum entry', async () => {
    const { controller, userUseCase } = buildDoulaController();
    (userUseCase.addNewHours as jest.Mock).mockResolvedValue({
      id: hourId,
      doula_id: doulaId,
      client_id: clientId,
      start_time: '2026-04-23T12:00:00.000Z',
      end_time: '2026-04-23T14:00:00.000Z',
      type: 'postpartum',
    });

    const app = buildApp();
    app.post('/api/doulas/hours', (req, res) => controller.logHours(req as AuthRequest, res));

    const res = await request(app)
      .post('/api/doulas/hours')
      .send({
        client_id: clientId,
        start_time: '2026-04-23T12:00:00.000Z',
        end_time: '2026-04-23T14:00:00.000Z',
        type: 'postpartum',
      });

    expect(res.status).toBe(201);
    expect(userUseCase.addNewHours).toHaveBeenCalledWith(
      doulaId,
      clientId,
      new Date('2026-04-23T12:00:00.000Z'),
      new Date('2026-04-23T14:00:00.000Z'),
      '',
      'postpartum'
    );
    expect(res.body.workEntry.type).toBe('postpartum');
  });

  it('rejects missing type', async () => {
    const { controller, userUseCase } = buildDoulaController();
    const app = buildApp();
    app.post('/api/doulas/hours', (req, res) => controller.logHours(req as AuthRequest, res));

    const res = await request(app)
      .post('/api/doulas/hours')
      .send({
        client_id: clientId,
        start_time: '2026-04-23T10:00:00.000Z',
        end_time: '2026-04-23T11:00:00.000Z',
      });

    expect(res.status).toBe(400);
    expect(userUseCase.addNewHours).not.toHaveBeenCalled();
    expect(res.body.error).toContain('type is required');
  });

  it('updates an existing entry type', async () => {
    const { controller, userUseCase } = buildDoulaController();
    (userUseCase.updateHourType as jest.Mock).mockResolvedValue({
      id: hourId,
      doula_id: doulaId,
      client_id: clientId,
      start_time: '2026-04-23T12:00:00.000Z',
      end_time: '2026-04-23T14:00:00.000Z',
      type: 'postpartum',
    });

    const app = buildApp();
    app.patch('/api/doulas/hours/:hourId', (req, res) => controller.updateHour(req as AuthRequest, res));

    const res = await request(app)
      .patch(`/api/doulas/hours/${hourId}`)
      .send({ type: 'postpartum' });

    expect(res.status).toBe(200);
    expect(userUseCase.updateHourType).toHaveBeenCalledWith(hourId, 'postpartum', doulaId);
    expect(res.body.workEntry.type).toBe('postpartum');
  });

  it('returns legacy rows with missing type as unknown and split totals', async () => {
    const legacyHours = [
      {
        id: 'h1',
        start_time: '2026-04-23T10:00:00.000Z',
        end_time: '2026-04-23T11:30:00.000Z',
        type: null,
        client: { id: clientId, user: { id: clientId } },
      },
      {
        id: 'h2',
        start_time: '2026-04-23T12:00:00.000Z',
        end_time: '2026-04-23T14:00:00.000Z',
        type: 'prenatal',
        client: { id: clientId, user: { id: clientId } },
      },
      {
        id: 'h3',
        start_time: '2026-04-23T15:00:00.000Z',
        end_time: '2026-04-23T17:00:00.000Z',
        type: 'postpartum',
        client: { id: clientId, user: { id: clientId } },
      },
    ];
    const { controller, userUseCase, clientUseCase } = buildDoulaController();
    (userUseCase.getHoursById as jest.Mock).mockResolvedValue(legacyHours);
    (clientUseCase.getClientsLite as jest.Mock).mockResolvedValue([{ id: clientId }]);

    const app = buildApp();
    app.get('/api/doulas/hours', (req, res) => controller.getMyHours(req as AuthRequest, res));

    const res = await request(app).get('/api/doulas/hours');

    expect(res.status).toBe(200);
    expect(res.body.hours).toHaveLength(3);
    expect(res.body.hours[0].type).toBeNull();
    expect(res.body.summary).toEqual({
      total_hours: 5.5,
      prenatal_hours: 2,
      postpartum_hours: 2,
      unknown_hours: 1.5,
    });
  });

  it('returns admin hours with type and summary totals', async () => {
    const userUseCase = {
      getAllHours: jest.fn().mockResolvedValue([
        {
          id: 'h1',
          start_time: '2026-04-23T10:00:00.000Z',
          end_time: '2026-04-23T11:00:00.000Z',
          type: 'prenatal',
        },
      ]),
    };
    const controller = buildUserController(userUseCase);
    const app = buildApp('admin');
    app.get('/api/users/:id/hours', (req, res) => controller.getHours(req as AuthRequest, res));

    const res = await request(app).get('/api/users/some-user/hours');

    expect(res.status).toBe(200);
    expect(res.body.hours[0].type).toBe('prenatal');
    expect(res.body.summary).toEqual({
      total_hours: 1,
      prenatal_hours: 1,
      postpartum_hours: 0,
      unknown_hours: 0,
    });
  });

  it('supports filtering hours by type', async () => {
    const { controller, userUseCase, clientUseCase } = buildDoulaController();
    (userUseCase.getHoursById as jest.Mock).mockResolvedValue([
      {
        id: 'h1',
        start_time: '2026-04-23T10:00:00.000Z',
        end_time: '2026-04-23T11:00:00.000Z',
        type: 'prenatal',
        client: { id: clientId, user: { id: clientId } },
      },
      {
        id: 'h2',
        start_time: '2026-04-23T12:00:00.000Z',
        end_time: '2026-04-23T13:00:00.000Z',
        type: 'postpartum',
        client: { id: clientId, user: { id: clientId } },
      },
    ]);
    (clientUseCase.getClientsLite as jest.Mock).mockResolvedValue([{ id: clientId }]);

    const app = buildApp();
    app.get('/api/doulas/hours', (req, res) => controller.getMyHours(req as AuthRequest, res));

    const res = await request(app).get('/api/doulas/hours?type=prenatal');

    expect(res.status).toBe(200);
    expect(res.body.hours).toHaveLength(1);
    expect(res.body.hours[0].type).toBe('prenatal');
    expect(res.body.summary).toEqual({
      total_hours: 1,
      prenatal_hours: 1,
      postpartum_hours: 0,
      unknown_hours: 0,
    });
  });
});
