import express from 'express';
import request from 'supertest';

import { RequestFormController } from '../controllers/requestFormController';
import { RequestFormService } from '../services/RequestFormService';

const mockGetPublicIntakeBrandingBySlug = jest.fn();

jest.mock(
  '../features/intake/infrastructure/publicIntakeBrandingRepository',
  () => ({
    getPublicIntakeBrandingBySlug: (...args: unknown[]) =>
      mockGetPublicIntakeBrandingBySlug(...args),
  })
);

describe('GET public intake branding', () => {
  let app: express.Application;

  beforeEach(() => {
    jest.clearAllMocks();
    const controller = new RequestFormController({} as RequestFormService);
    app = express();
    app.get('/requestService/public/:tenantSlug', (req, res) =>
      controller.getPublicBranding(req, res)
    );
  });

  it('returns branding for sokana360', async () => {
    mockGetPublicIntakeBrandingBySlug.mockResolvedValue({
      slug: 'sokana360',
      name: 'Sokana360',
      branding: {
        displayName: 'Sokana360',
        logoPath: '/sokana360-logo.png',
        markPath: '/sokana360-mark.png',
        pageTitle: 'Request for Service',
        primaryColor: '#009688',
        accentColor: '#00bcd4',
      },
    });

    const response = await request(app)
      .get('/requestService/public/sokana360')
      .expect(200);

    expect(response.body.slug).toBe('sokana360');
    expect(response.body.branding.displayName).toBe('Sokana360');
  });

  it('returns 404 for unknown slug', async () => {
    mockGetPublicIntakeBrandingBySlug.mockResolvedValue(null);

    await request(app).get('/requestService/public/missing').expect(404);
  });
});
