import express from 'express';
import request from 'supertest';
import { DoulaController } from '../controllers/doulaController';
import { Activity } from '../entities/Activity';
import type { AuthRequest } from '../types';

describe('GET /api/doulas/clients/:id/activities', () => {
  it('returns created_by_name for assigned doula', async () => {
    const doulaId = 'doula-123';
    const clientId = '1d981375-beeb-46e7-bf22-5d7a750eb391';
    const createdBy = '528e4d28-b24a-47f1-a66b-d7ddd507b7b9';

    const activityRepository = {
      getActivitiesByClientId: jest.fn().mockResolvedValue([
        new Activity(
          'a1b2c3',
          clientId,
          'note',
          'Follow-up complete',
          { category: 'general', visibleToClient: false },
          new Date('2026-03-23T20:31:00.000Z'),
          createdBy,
          'Jordan Bony',
          'admin'
        ),
      ]),
    };

    const clientUseCase = {
      getClientsLite: jest.fn().mockResolvedValue([{ id: clientId }]),
    };

    const controller = new DoulaController(
      {} as any,
      {} as any,
      {} as any,
      activityRepository as any,
      {} as any,
      {} as any,
      clientUseCase as any
    );

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as AuthRequest).user = {
        id: doulaId,
        email: 'info@techluminateacademy.com',
        role: 'doula' as any,
      } as any;
      next();
    });

    app.get('/api/doulas/clients/:clientId/activities', (req, res) =>
      controller.getClientActivities(req as AuthRequest, res)
    );

    const res = await request(app).get(`/api/doulas/clients/${clientId}/activities`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.activities).toHaveLength(1);
    expect(res.body.activities[0]).toEqual(
      expect.objectContaining({
        id: 'a1b2c3',
        client_id: clientId,
        created_by: createdBy,
        created_by_name: 'Jordan Bony',
        created_by_role: 'admin',
      })
    );
    expect(clientUseCase.getClientsLite).toHaveBeenCalledWith(doulaId, 'doula');
    expect(activityRepository.getActivitiesByClientId).toHaveBeenCalledWith(clientId);
  });
});
