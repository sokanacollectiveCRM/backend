import fs from 'fs';
import path from 'path';

export function isCloudRun(): boolean {
  return Boolean(process.env.K_SERVICE || process.env.CLOUD_RUN);
}

const explicitGeneratedDir = process.env.GENERATED_DIR;

export const GENERATED_DIR =
  explicitGeneratedDir ||
  (isCloudRun() ? '/tmp/generated' : path.join(process.cwd(), 'generated'));

export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
