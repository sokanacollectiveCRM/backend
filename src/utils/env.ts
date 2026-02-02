export function optionalEnv(name: string, defaultValue?: string): string | undefined {
  const value = process.env[name];
  return value === undefined || value === '' ? defaultValue : value;
}

export function requireEnv(name: string): string {
  const value = optionalEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
