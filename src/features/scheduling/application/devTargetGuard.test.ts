import { assertDevSchedulingTarget } from './devTargetGuard';

describe('scheduling fixture guard', () => {
  it('refuses production NODE_ENV', () => {
    expect(() =>
      assertDevSchedulingTarget({
        NODE_ENV: 'production',
        CLOUD_SQL_DATABASE: 'sokana_private_dev',
      })
    ).toThrow(/NODE_ENV=production/);
  });

  it('refuses a target that does not contain "dev"', () => {
    expect(() =>
      assertDevSchedulingTarget({
        NODE_ENV: 'development',
        CLOUD_SQL_DATABASE: 'sokana_private',
        CLOUD_SQL_HOST: '127.0.0.1',
      })
    ).toThrow(/must contain "dev"/);
  });

  it('allows a dev database or instance name', () => {
    expect(() =>
      assertDevSchedulingTarget({
        NODE_ENV: 'development',
        CLOUD_SQL_DATABASE: 'sokana_private_dev',
      })
    ).not.toThrow();
    expect(() =>
      assertDevSchedulingTarget({
        NODE_ENV: 'development',
        CLOUD_SQL_CONNECTION_NAME: 'project:region:sokana-dev',
        CLOUD_SQL_DATABASE: 'sokana_private',
      })
    ).not.toThrow();
  });
});
