export function assertDevSchedulingTarget(
  env: NodeJS.ProcessEnv = process.env
): void {
  const nodeEnv = (env.NODE_ENV || 'development').toLowerCase();
  if (nodeEnv === 'production') {
    throw new Error('Refusing to run scheduling fixture: NODE_ENV=production');
  }

  const haystack = [
    env.CLOUD_SQL_HOST,
    env.CLOUD_SQL_DATABASE,
    env.CLOUD_SQL_INSTANCE,
    env.CLOUD_SQL_CONNECTION_NAME,
    env.INSTANCE_CONNECTION_NAME,
    env.DATABASE_URL,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (!haystack.includes('dev')) {
    throw new Error(
      'Refusing to run scheduling fixture: target host/database/instance must contain "dev". ' +
        'This script never runs against production.'
    );
  }
}
