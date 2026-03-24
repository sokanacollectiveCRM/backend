import express from 'express';
import request from 'supertest';
import { ClientController } from '../controllers/clientController';
import { ClientUseCase } from '../usecase/clientUseCase';
import { Activity } from '../entities/Activity';

describe('HTTP integration: client activity metadata flow', () => {
  const clientId = '1d981375-beeb-46e7-bf22-5d7a750eb391';

  function buildApp() {
    const activities: Activity[] = [];

    const activityRepository: any = {
      async createActivity(activityData: {
        clientId: string;
        type: string;
        description?: string;
        metadata?: any;
        timestamp: Date;
        createdBy?: string;
      }) {
        const created = new Activity(
          `activity-${activities.length + 1}`,
          activityData.clientId,
          activityData.type,
          activityData.description ?? '',
          activityData.metadata ?? {},
          activityData.timestamp,
          activityData.createdBy,
          typeof activityData.metadata?.createdByName === 'string'
            ? activityData.metadata.createdByName
            : undefined,
          typeof activityData.metadata?.createdByRole === 'string'
            ? activityData.metadata.createdByRole
            : undefined
        );
        activities.unshift(created);
        return created;
      },
      async getActivitiesByClientId(id: string) {
        return activities.filter((a) => a.clientId === id);
      },
      async getAllActivities() {
        return activities;
      },
      async updateActivityMetadataMerge() {
        return null;
      },
    };

    const clientRepository: any = {
      async getClientById(id: string) {
        return id === clientId ? { id } : null;
      },
    };

    const clientUseCase = new ClientUseCase(clientRepository, activityRepository);
    const controller = new ClientController(clientUseCase, {} as any, clientRepository);

    const app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => {
      req.user = {
        id: 'admin-uuid',
        email: 'jbony@icstars.org',
        firstname: 'Jordan',
        lastname: 'Bony',
        role: 'admin',
      };
      next();
    });

    app.post('/clients/:id/activity', (req, res) => controller.createActivity(req as any, res));
    app.get('/clients/:id/activities', (req, res) => controller.getClientActivities(req as any, res));

    return app;
  }

  beforeEach(() => {
    process.env.SPLIT_DB_READ_MODE = 'primary';
  });

  it('POST + GET preserve and return birth-outcomes metadata', async () => {
    const app = buildApp();

    const postRes = await request(app)
      .post(`/clients/${clientId}/activity`)
      .send({
        activity_type: 'note',
        content: 'nice birth',
        metadata: { category: 'birth-outcomes', field: 'birth_outcomes' },
      });

    expect(postRes.status).toBe(200);
    expect(postRes.body.success).toBe(true);
    expect(postRes.body.data).toEqual(
      expect.objectContaining({
        activity_type: 'note',
        content: 'nice birth',
        metadata: expect.objectContaining({
          category: 'birth-outcomes',
          field: 'birth_outcomes',
        }),
      })
    );

    const getRes = await request(app).get(`/clients/${clientId}/activities`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.success).toBe(true);
    expect(Array.isArray(getRes.body.data)).toBe(true);
    expect(getRes.body.data[0]).toEqual(
      expect.objectContaining({
        activity_type: 'note',
        content: 'nice birth',
        metadata: expect.objectContaining({
          category: 'birth-outcomes',
          field: 'birth_outcomes',
        }),
      })
    );
  });

  it('regression: create without metadata still succeeds', async () => {
    const app = buildApp();
    const res = await request(app)
      .post(`/clients/${clientId}/activity`)
      .send({
        activity_type: 'note',
        content: 'plain note',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.activity_type).toBe('note');
    expect(res.body.data.content).toBe('plain note');
  });
});
