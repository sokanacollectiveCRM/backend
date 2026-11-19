import express from 'express';
import multer from 'multer';
import request from 'supertest';

import { readTenantRequestState, runWithTenant } from '../features/tenancy';
import { preserveTenantContext } from '../middleware/preserveTenantContext';

function uploadApp() {
  const app = express();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 32 },
  });
  app.post(
    '/upload',
    (req, _res, next) => {
      runWithTenant(String(req.header('x-test-tenant')), next);
    },
    preserveTenantContext(upload.single('profile_picture')),
    (req, res) => {
      res.json({
        ...readTenantRequestState(),
        filename: (req as express.Request & { file?: { originalname: string } })
          .file?.originalname,
      });
    }
  );
  app.use(
    (
      error: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      res
        .status(400)
        .json({ ...readTenantRequestState(), error: error.message });
    }
  );
  return app;
}

describe('multipart tenant context', () => {
  it('preserves the authenticated organization after a real multipart upload', async () => {
    const response = await request(uploadApp())
      .post('/upload')
      .set('x-test-tenant', 'tenant-a')
      .attach('profile_picture', Buffer.from('image'), {
        filename: 'headshot.png',
        contentType: 'image/png',
      });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      tenantId: 'tenant-a',
      bypass: false,
      filename: 'headshot.png',
    });
  });

  it('keeps concurrent uploads in their own organizations', async () => {
    const app = uploadApp();
    const responses = await Promise.all(
      ['tenant-a', 'tenant-b'].map((tenant) =>
        request(app)
          .post('/upload')
          .set('x-test-tenant', tenant)
          .attach('profile_picture', Buffer.from('image'), 'headshot.png')
      )
    );
    expect(responses.map((response) => response.body.tenantId)).toEqual([
      'tenant-a',
      'tenant-b',
    ]);
    expect(readTenantRequestState()).toEqual({ tenantId: null, bypass: false });
  });

  it('preserves context on parser errors without swallowing the error', async () => {
    const response = await request(uploadApp())
      .post('/upload')
      .set('x-test-tenant', 'tenant-a')
      .attach('profile_picture', Buffer.alloc(64), 'too-large.png');
    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      tenantId: 'tenant-a',
      bypass: false,
      error: 'File too large',
    });
  });
});
