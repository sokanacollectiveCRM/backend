import fs from 'fs';
import path from 'path';

export function isCloudRun(): boolean {
  return Boolean(process.env.K_SERVICE || process.env.CLOUD_RUN);
}

const explicitGeneratedDir = process.env.GENERATED_DIR;

export const GENERATED_DIR =
  explicitGeneratedDir ||
  (isCloudRun() ? '/tmp/generated' : path.join(process.cwd(), 'generated'));

export const DOCUSIGN_TOKEN_PATH = isCloudRun()
  ? '/tmp/.docusign-token.json'
  : path.join(process.cwd(), '.docusign-token.json');

export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
