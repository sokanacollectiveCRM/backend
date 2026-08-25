describe('getAllowedOrigins', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('includes FRONTEND_ORIGIN and legacy vars', async () => {
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_ORIGIN =
      'https://sokana-front-end-634744984887.us-central1.run.app';
    process.env.FRONTEND_URL = 'https://example.com';

    const { getAllowedOrigins } = await import('../config/env');
    const origins = getAllowedOrigins();

    expect(origins).toEqual(
      expect.arrayContaining([
        'https://sokana-front-end-634744984887.us-central1.run.app',
        'https://example.com',
      ])
    );
    expect(origins.some((o) => o.includes('vercel.app'))).toBe(false);
  });

  it('does not fall back to Vercel URLs when production env is unset', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.FRONTEND_ORIGIN;
    delete process.env.CORS_ORIGIN;
    delete process.env.FRONTEND_URL;
    delete process.env.FRONTEND_URL_DEV;

    const { getAllowedOrigins } = await import('../config/env');
    const origins = getAllowedOrigins();

    expect(origins).toEqual([]);
  });

  it('includes localhost dev origins outside production', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.FRONTEND_ORIGIN;

    const { getAllowedOrigins } = await import('../config/env');
    const origins = getAllowedOrigins();

    expect(origins).toEqual(
      expect.arrayContaining(['http://localhost:3001', 'http://localhost:5173'])
    );
  });
});
